#!/usr/bin/env bash
set -euo pipefail

# ─── Global External Application Load Balancer ──────────────────────────────
#
# Expõe os serviços Cloud Run em domínios próprios com TLS gerenciado:
#
#   https://api.elosmed.com.br  →  Cloud Run: ${ENV}-elosmed-api
#   https://app.elosmed.com.br  →  Cloud Run: ${ENV}-elosmed-web
#
# Recursos criados (todos globais):
#   - IP estático global (PREMIUM)
#   - 2 Serverless NEGs regionais (southamerica-east1)
#   - 2 Backend Services globais (HTTP — serverless NEGs não usam port_name)
#   - URL Map HTTPS (roteamento por host)
#   - URL Map HTTP (redirect permanente → HTTPS)
#   - Certificado SSL Google-managed global (auto-provisioned via DNS)
#   - Target HTTPS Proxy + Target HTTP Proxy (globais)
#   - 2 Forwarding Rules globais (porta 443 + porta 80)
#   - 2 Cloud DNS A records (api + app → IP do LB)
#
# Pré-requisitos:
#   - gcloud autenticado com permissões Compute + DNS no projeto
#   - Cloud Run services já deployados
#   - Managed DNS zone já criada (verifique: gcloud dns managed-zones list --project=elos-med)
#   - NS da zona apontando para Google Cloud DNS no registrador
#
# Uso:
#   bash scripts/provision-lb.sh                        # staging, zone elosmed-com-br
#   bash scripts/provision-lb.sh prod
#   bash scripts/provision-lb.sh staging minha-zone

ENV="${1:-staging}"
DNS_ZONE="${2:-elosmed-com-br}"
PROJECT="elos-med"
REGION="southamerica-east1"
PREFIX="${ENV}-elosmed"

API_SERVICE="${PREFIX}-api"
WEB_SERVICE="${PREFIX}-web"
IP_NAME="${PREFIX}-lb-ip"
NEG_API="${PREFIX}-neg-api"
NEG_WEB="${PREFIX}-neg-web"
BS_API="${PREFIX}-bs-api"
BS_WEB="${PREFIX}-bs-web"
URL_MAP="${PREFIX}-url-map"
HTTP_URL_MAP="${PREFIX}-http-url-map"
CERT="${PREFIX}-cert"
HTTPS_PROXY_RES="${PREFIX}-https-proxy"
HTTP_PROXY_RES="${PREFIX}-http-proxy"
HTTPS_RULE="${PREFIX}-https-rule"
HTTP_RULE="${PREFIX}-http-rule"

echo "▶ Env:      ${ENV}"
echo "▶ Project:  ${PROJECT}"
echo "▶ Region:   ${REGION} (Cloud Run)"
echo "▶ DNS Zone: ${DNS_ZONE}"
echo ""

# ── Pré-flight ───────────────────────────────────────────────────────────────
echo "▶ Verificando Cloud Run services..."
for SVC in "${API_SERVICE}" "${WEB_SERVICE}"; do
  if ! gcloud run services describe "${SVC}" --project="${PROJECT}" --region="${REGION}" >/dev/null 2>&1; then
    echo "✗ Cloud Run service '${SVC}' não encontrado. Deploy primeiro: git push origin main" >&2
    exit 1
  fi
done
echo "  ✓ ${API_SERVICE} e ${WEB_SERVICE} encontrados"

echo "▶ Verificando DNS zone '${DNS_ZONE}'..."
if ! gcloud dns managed-zones describe "${DNS_ZONE}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "✗ DNS zone '${DNS_ZONE}' não encontrada." >&2
  gcloud dns managed-zones list --project="${PROJECT}" --format="table(name,dnsName)" >&2
  exit 1
fi
echo "  ✓ Zone encontrada"
echo ""

# ── 1. IP Global ─────────────────────────────────────────────────────────────
echo "▶ [1/8] IP estático global (PREMIUM)..."
if ! gcloud compute addresses describe "${IP_NAME}" --project="${PROJECT}" --global >/dev/null 2>&1; then
  gcloud compute addresses create "${IP_NAME}" --project="${PROJECT}" --global --network-tier=PREMIUM
fi
LB_IP=$(gcloud compute addresses describe "${IP_NAME}" --project="${PROJECT}" --global --format='value(address)')
echo "  ✓ IP: ${LB_IP}"

# ── 2. Serverless NEGs (regionais — apontam para Cloud Run) ──────────────────
echo ""
echo "▶ [2/8] Serverless NEGs regionais..."
for NEG_NAME in "${NEG_API}" "${NEG_WEB}"; do
  if ! gcloud compute network-endpoint-groups describe "${NEG_NAME}" \
    --project="${PROJECT}" --region="${REGION}" >/dev/null 2>&1; then
    if [[ "${NEG_NAME}" == "${NEG_API}" ]]; then SVC="${API_SERVICE}"; else SVC="${WEB_SERVICE}"; fi
    gcloud compute network-endpoint-groups create "${NEG_NAME}" \
      --project="${PROJECT}" --region="${REGION}" \
      --network-endpoint-type=serverless \
      --cloud-run-service="${SVC}"
    echo "  ✓ ${NEG_NAME} → ${SVC}"
  else
    echo "  ${NEG_NAME} já existe"
  fi
done

# ── 3. Backend Services globais ───────────────────────────────────────────────
# Não especificar --protocol para serverless NEGs (evita port_name inválido)
echo ""
echo "▶ [3/8] Backend Services globais..."
for BS_NAME in "${BS_API}" "${BS_WEB}"; do
  if ! gcloud compute backend-services describe "${BS_NAME}" --project="${PROJECT}" --global >/dev/null 2>&1; then
    gcloud compute backend-services create "${BS_NAME}" \
      --project="${PROJECT}" --load-balancing-scheme=EXTERNAL_MANAGED --global
    if [[ "${BS_NAME}" == "${BS_API}" ]]; then NEG="${NEG_API}"; else NEG="${NEG_WEB}"; fi
    gcloud compute backend-services add-backend "${BS_NAME}" \
      --project="${PROJECT}" --global \
      --network-endpoint-group="${NEG}" \
      --network-endpoint-group-region="${REGION}"
    echo "  ✓ ${BS_NAME}"
  else
    echo "  ${BS_NAME} já existe"
  fi
done

# ── 4. URL Map HTTPS (roteamento por host) ────────────────────────────────────
echo ""
echo "▶ [4/8] URL Map HTTPS (host-based routing)..."
if ! gcloud compute url-maps describe "${URL_MAP}" --project="${PROJECT}" --global >/dev/null 2>&1; then
  cat > /tmp/${PREFIX}-url-map.yaml << YAML
name: ${URL_MAP}
defaultService: global/backendServices/${BS_WEB}
hostRules:
  - hosts: [api.elosmed.com.br]
    pathMatcher: api-matcher
  - hosts: [app.elosmed.com.br]
    pathMatcher: web-matcher
pathMatchers:
  - name: api-matcher
    defaultService: global/backendServices/${BS_API}
  - name: web-matcher
    defaultService: global/backendServices/${BS_WEB}
YAML
  gcloud compute url-maps import "${URL_MAP}" --project="${PROJECT}" --global \
    --source=/tmp/${PREFIX}-url-map.yaml --quiet
  echo "  ✓ URL Map HTTPS"
else
  echo "  URL Map já existe"
fi

# ── 5. URL Map HTTP → HTTPS redirect ──────────────────────────────────────────
echo ""
echo "▶ [5/8] URL Map HTTP (redirect → HTTPS)..."
if ! gcloud compute url-maps describe "${HTTP_URL_MAP}" --project="${PROJECT}" --global >/dev/null 2>&1; then
  cat > /tmp/${PREFIX}-http-url-map.yaml << YAML
name: ${HTTP_URL_MAP}
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
  stripQuery: false
YAML
  gcloud compute url-maps import "${HTTP_URL_MAP}" --project="${PROJECT}" --global \
    --source=/tmp/${PREFIX}-http-url-map.yaml --quiet
  echo "  ✓ URL Map HTTP"
else
  echo "  HTTP URL Map já existe"
fi

# ── 6. Certificado SSL Google-managed global ──────────────────────────────────
echo ""
echo "▶ [6/8] Certificado SSL Google-managed..."
if ! gcloud compute ssl-certificates describe "${CERT}" --project="${PROJECT}" --global >/dev/null 2>&1; then
  gcloud compute ssl-certificates create "${CERT}" \
    --project="${PROJECT}" --global \
    --domains="api.elosmed.com.br,app.elosmed.com.br"
  echo "  ✓ Cert criado (PROVISIONING → ACTIVE após DNS propagar)"
else
  echo "  Cert já existe"
fi

# ── 7. Target Proxies globais ─────────────────────────────────────────────────
echo ""
echo "▶ [7/8] Target Proxies globais..."
if ! gcloud compute target-https-proxies describe "${HTTPS_PROXY_RES}" \
  --project="${PROJECT}" --global >/dev/null 2>&1; then
  gcloud compute target-https-proxies create "${HTTPS_PROXY_RES}" \
    --project="${PROJECT}" --global \
    --url-map="${URL_MAP}" --ssl-certificates="${CERT}"
  echo "  ✓ HTTPS Proxy"
else
  echo "  HTTPS Proxy já existe"
fi

if ! gcloud compute target-http-proxies describe "${HTTP_PROXY_RES}" \
  --project="${PROJECT}" --global >/dev/null 2>&1; then
  gcloud compute target-http-proxies create "${HTTP_PROXY_RES}" \
    --project="${PROJECT}" --global --url-map="${HTTP_URL_MAP}"
  echo "  ✓ HTTP Proxy"
else
  echo "  HTTP Proxy já existe"
fi

# ── 8. Forwarding Rules + DNS ─────────────────────────────────────────────────
echo ""
echo "▶ [8/8] Forwarding Rules + DNS A records..."
if ! gcloud compute forwarding-rules describe "${HTTPS_RULE}" \
  --project="${PROJECT}" --global >/dev/null 2>&1; then
  gcloud compute forwarding-rules create "${HTTPS_RULE}" \
    --project="${PROJECT}" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --ip-protocol=TCP --ports=443 \
    --address="${IP_NAME}" \
    --target-https-proxy="${HTTPS_PROXY_RES}"
  echo "  ✓ FR HTTPS (443)"
else
  echo "  FR HTTPS já existe"
fi

if ! gcloud compute forwarding-rules describe "${HTTP_RULE}" \
  --project="${PROJECT}" --global >/dev/null 2>&1; then
  gcloud compute forwarding-rules create "${HTTP_RULE}" \
    --project="${PROJECT}" --global \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --ip-protocol=TCP --ports=80 \
    --address="${IP_NAME}" \
    --target-http-proxy="${HTTP_PROXY_RES}"
  echo "  ✓ FR HTTP (80)"
else
  echo "  FR HTTP já existe"
fi

for SUBDOMAIN in api app; do
  FQDN="${SUBDOMAIN}.elosmed.com.br."
  EXISTING=$(gcloud dns record-sets list --project="${PROJECT}" --zone="${DNS_ZONE}" \
    --filter="type=A AND name=${FQDN}" --format='value(rrdatas)' 2>/dev/null || true)
  if [[ -n "${EXISTING}" ]]; then
    [[ "${EXISTING}" != "${LB_IP}" ]] && \
      gcloud dns record-sets update "${FQDN}" --project="${PROJECT}" --zone="${DNS_ZONE}" \
        --type=A --ttl=300 --rrdatas="${LB_IP}" && echo "  ✓ A record ${FQDN} atualizado" || \
      echo "  A record ${FQDN} já correto"
  else
    gcloud dns record-sets create "${FQDN}" --project="${PROJECT}" --zone="${DNS_ZONE}" \
      --type=A --ttl=300 --rrdatas="${LB_IP}"
    echo "  ✓ A record ${FQDN} → ${LB_IP}"
  fi
done

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo " ✓ Global External ALB provisionado!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  IP:  ${LB_IP}"
echo "  https://api.elosmed.com.br  →  ${API_SERVICE}"
echo "  https://app.elosmed.com.br  →  ${WEB_SERVICE}"
echo ""
echo "Próximos passos:"
echo ""
echo "  1. Monitorar cert (aguarde 15-60 min):"
echo "     gcloud compute ssl-certificates describe ${CERT} \\"
echo "       --project=${PROJECT} --global \\"
echo "       --format='table(name,managed.status,managed.domainStatus)'"
echo ""
echo "  2. Testar após ACTIVE:"
echo "     curl -I https://api.elosmed.com.br/health"
echo "     curl -I https://app.elosmed.com.br"
echo ""
echo "  3. (Já configurado no deploy.yml)"
echo "     ingress=internal-and-cloud-load-balancing para api/web"
