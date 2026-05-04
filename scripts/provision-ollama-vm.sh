#!/usr/bin/env bash
set -euo pipefail

# ─── Ollama GPU VM — inference local de PHI ─────────────────────────────────
#
# Cria uma VM GCE com GPU em southamerica-east1 rodando Ollama.
# A VM fica na VPC privada (sem IP público); Cloud Run acessa via
# VPC connector. O IP privado é armazenado no Secret Manager como
# `ollama-base-url = http://<PRIVATE_IP>:11434`.
#
# Tiers de GPU disponíveis em southamerica-east1:
#
#   Tier 1 — T4 (16GB VRAM)    ~R$1.400/mês on-demand | ~R$450/mês spot
#             Modelos:  llama3.1:8b, llama3.2:11b-vision-instruct, gemma2:9b
#
#   Tier 2 — L4 (24GB VRAM)    ~R$3.700/mês on-demand | ~R$1.100/mês spot
#             Modelos:  phi3:14b, llama3.2:11b-vision-instruct, mistral:7b
#             Qualidade: notavelmente melhor em PT-BR médico que 8B
#
#   Para 70B (Llama 3.1 70B): A100 não disponível em southamerica-east1.
#             Use Claude API para consultas não-PHI de alta qualidade.
#
# Uso:
#   bash scripts/provision-ollama-vm.sh                        # staging, tier 1
#   bash scripts/provision-ollama-vm.sh staging 2              # tier 2 (L4)
#   bash scripts/provision-ollama-vm.sh staging 1 llama3.2:11b-vision-instruct

ENV="${1:-staging}"
TIER="${2:-1}"
MODEL_OVERRIDE="${3:-}"

PROJECT="elos-med"
REGION="southamerica-east1"
PREFIX="${ENV}-elosmed"
VPC_NETWORK="${PREFIX}-vpc"
SUBNET="${PREFIX}-subnet"
# IP range do VPC connector — único recurso autorizado a acessar Ollama
CONNECTOR_CIDR="10.10.16.0/28"

VM_NAME="${PREFIX}-ollama"
SECRET_NAME="ollama-base-url"
FIREWALL_RULE="${PREFIX}-allow-ollama-internal"
SA_NAME="${PREFIX}-ollama"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

# ── Configuração por tier ─────────────────────────────────────────────────────
case "${TIER}" in
  1)
    MACHINE_TYPE="n1-standard-4"   # 4 vCPU, 15 GB RAM
    GPU_TYPE="nvidia-tesla-t4"     # 16 GB VRAM
    GPU_COUNT=1
    DEFAULT_MODEL="llama3.1:8b"
    DISK_SIZE=80
    COST_EST="~R\$1.400/mês on-demand | ~R\$450/mês spot"
    ;;
  2)
    MACHINE_TYPE="g2-standard-4"   # 4 vCPU, 16 GB RAM
    GPU_TYPE="nvidia-l4"           # 24 GB VRAM
    GPU_COUNT=1
    DEFAULT_MODEL="phi3:14b"
    DISK_SIZE=120
    COST_EST="~R\$3.700/mês on-demand | ~R\$1.100/mês spot"
    ;;
  *)
    echo "✗ Tier inválido. Use 1 (T4) ou 2 (L4)." >&2
    echo "  Para 70B parameters: use Claude API (LGPD: dados não-PHI)." >&2
    exit 1
    ;;
esac

MODEL="${MODEL_OVERRIDE:-${DEFAULT_MODEL}}"
# Zona com disponibilidade confirmada de T4/L4 em southamerica-east1
ZONE="${REGION}-b"

# Imagem com CUDA 12.1 pré-instalado (evita 20 min de setup no primeiro boot)
IMAGE_PROJECT="deeplearning-platform-release"
IMAGE_FAMILY="common-cu121-ubuntu-2204-py310"

echo "═══════════════════════════════════════════════════════"
echo " Ollama GPU VM — ${ENV} / Tier ${TIER}"
echo "═══════════════════════════════════════════════════════"
echo "  VM:      ${VM_NAME}"
echo "  Machine: ${MACHINE_TYPE} + ${GPU_TYPE} x${GPU_COUNT}"
echo "  Model:   ${MODEL}"
echo "  Zone:    ${ZONE}"
echo "  Custo:   ${COST_EST}"
echo ""

# ── Pré-flight ────────────────────────────────────────────────────────────────
echo "▶ Verificando VPC e subnet..."
if ! gcloud compute networks describe "${VPC_NETWORK}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "✗ VPC '${VPC_NETWORK}' não encontrada." >&2; exit 1
fi
if ! gcloud compute networks subnets describe "${SUBNET}" \
  --project="${PROJECT}" --region="${REGION}" >/dev/null 2>&1; then
  echo "✗ Subnet '${SUBNET}' não encontrada em ${REGION}." >&2; exit 1
fi
echo "  ✓ VPC e subnet OK"

# ── 1. Service Account dedicado ───────────────────────────────────────────────
echo ""
echo "▶ [1/6] Service Account..."
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" \
    --project="${PROJECT}" \
    --display-name="Ollama VM (${ENV})"
  # Permite acessar Secret Manager (para ler configuração futura)
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None --quiet
  echo "  ✓ SA criado: ${SA_EMAIL}"
else
  echo "  SA já existe: ${SA_EMAIL}"
fi

# ── 2. Firewall rule ──────────────────────────────────────────────────────────
echo ""
echo "▶ [2/6] Firewall rule (porta 11434 do VPC connector → VM)..."
if ! gcloud compute firewall-rules describe "${FIREWALL_RULE}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud compute firewall-rules create "${FIREWALL_RULE}" \
    --project="${PROJECT}" \
    --network="${VPC_NETWORK}" \
    --direction=INGRESS \
    --priority=1000 \
    --action=ALLOW \
    --rules=tcp:11434 \
    --source-ranges="${CONNECTOR_CIDR}" \
    --target-tags="${VM_NAME}" \
    --description="Allow Cloud Run VPC connector to reach Ollama"
  echo "  ✓ Firewall rule criada (${CONNECTOR_CIDR} → tcp:11434)"
else
  echo "  Firewall rule já existe"
fi

# ── 3. Startup script ─────────────────────────────────────────────────────────
# O script é executado pelo VM na inicialização (como root).
# Como a imagem deeplearning já tem CUDA, só instalamos Ollama e puxamos o modelo.
STARTUP_SCRIPT=$(cat << SCRIPT
#!/bin/bash
set -euo pipefail
LOGFILE="/var/log/ollama-startup.log"
exec >> "\${LOGFILE}" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ── Iniciando setup Ollama ──"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Modelo alvo: ${MODEL}"

# Verificar GPU
if ! nvidia-smi >/dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] AVISO: nvidia-smi falhou — aguardando drivers..."
  sleep 60
fi
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null || true

# Instalar Ollama (idempotente)
if ! command -v ollama >/dev/null 2>&1; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Instalando Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

# Configurar Ollama: escutar em todas as interfaces (VPC only — sem IP público)
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/opt/ollama/models"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
EOF

mkdir -p /opt/ollama/models
systemctl daemon-reload
systemctl enable ollama
systemctl restart ollama

# Aguardar Ollama iniciar
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Aguardando Ollama iniciar..."
for i in \$(seq 1 30); do
  if curl -sf http://localhost:11434/api/version >/dev/null 2>&1; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ollama ativo!"
    break
  fi
  sleep 5
done

# Pull do modelo (pode demorar 5-30 min dependendo do tamanho)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Puxando modelo: ${MODEL} ..."
ollama pull "${MODEL}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ── Setup concluído ──"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Modelos disponíveis:"
ollama list
SCRIPT
)

# ── 4. Criar VM ───────────────────────────────────────────────────────────────
echo ""
echo "▶ [3/6] Criando VM ${VM_NAME}..."

if gcloud compute instances describe "${VM_NAME}" --project="${PROJECT}" --zone="${ZONE}" >/dev/null 2>&1; then
  echo "  VM '${VM_NAME}' já existe — pulando criação."
else
  gcloud compute instances create "${VM_NAME}" \
    --project="${PROJECT}" \
    --zone="${ZONE}" \
    --machine-type="${MACHINE_TYPE}" \
    --accelerator="type=${GPU_TYPE},count=${GPU_COUNT}" \
    --maintenance-policy=TERMINATE \
    --restart-on-failure \
    --image-project="${IMAGE_PROJECT}" \
    --image-family="${IMAGE_FAMILY}" \
    --boot-disk-size="${DISK_SIZE}GB" \
    --boot-disk-type=pd-ssd \
    --no-address \
    --network="${VPC_NETWORK}" \
    --subnet="${SUBNET}" \
    --tags="${VM_NAME}" \
    --service-account="${SA_EMAIL}" \
    --scopes="https://www.googleapis.com/auth/cloud-platform" \
    --metadata-from-file=startup-script=<(echo "${STARTUP_SCRIPT}") \
    --metadata="model=${MODEL},tier=${TIER}"
  echo "  ✓ VM criada"
fi

# ── 5. Obter IP privado e salvar secret ───────────────────────────────────────
echo ""
echo "▶ [4/6] Obtendo IP privado da VM..."
PRIVATE_IP=$(gcloud compute instances describe "${VM_NAME}" \
  --project="${PROJECT}" \
  --zone="${ZONE}" \
  --format='value(networkInterfaces[0].networkIP)')
echo "  ✓ IP privado: ${PRIVATE_IP}"

OLLAMA_URL="http://${PRIVATE_IP}:11434"
echo ""
echo "▶ [5/6] Salvando secret '${SECRET_NAME}' = ${OLLAMA_URL}..."

# Garante que o container do secret existe
if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud secrets create "${SECRET_NAME}" \
    --project="${PROJECT}" \
    --replication-policy=user-managed \
    --locations="${REGION}" \
    --labels="env=${ENV},app=elosmed"
  echo "  ✓ Secret container criado"
fi

printf '%s' "${OLLAMA_URL}" | gcloud secrets versions add "${SECRET_NAME}" \
  --project="${PROJECT}" \
  --data-file=-
echo "  ✓ Secret atualizado: ${OLLAMA_URL}"

# ── 6. IAM: permitir que api e worker leiam o secret ─────────────────────────
echo ""
echo "▶ [6/6] IAM: permitindo leitura do secret para api/worker..."
for SVC in api worker; do
  MEMBER="serviceAccount:${PREFIX}-${SVC}@${PROJECT}.iam.gserviceaccount.com"
  gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
    --project="${PROJECT}" \
    --member="${MEMBER}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None \
    --quiet 2>/dev/null || true
  echo "  ✓ ${PREFIX}-${SVC} pode ler ${SECRET_NAME}"
done

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo " ✓ Ollama VM provisionada!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  VM:         ${VM_NAME} (${ZONE})"
echo "  GPU:        ${GPU_TYPE} x${GPU_COUNT}"
echo "  IP privado: ${PRIVATE_IP}"
echo "  Secret:     ${SECRET_NAME} = ${OLLAMA_URL}"
echo "  Modelo:     ${MODEL} (pull em andamento no background)"
echo ""
echo "Monitorar startup (pode levar 5-30 min para pull do modelo):"
echo "  gcloud compute ssh ${VM_NAME} --project=${PROJECT} --zone=${ZONE} \\"
echo "    --tunnel-through-iap -- 'tail -f /var/log/ollama-startup.log'"
echo ""
echo "Verificar modelo disponível:"
echo "  gcloud compute ssh ${VM_NAME} --project=${PROJECT} --zone=${ZONE} \\"
echo "    --tunnel-through-iap -- 'ollama list'"
echo ""
echo "Próximo passo:"
echo "  Adicionar OLLAMA_BASE_URL ao deploy.yml (secret: ${SECRET_NAME}:latest)"
echo "  e fazer git push origin main para o API service recarregar."
