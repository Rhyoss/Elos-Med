# Bootstrap GCP (manual, executar uma única vez)

Este passo-a-passo cria o que **não pode** ser criado pelo Terraform:
projetos, billing link, APIs base, buckets de state e a SA que o
Terraform usa.

Pré-requisitos locais:

```bash
gcloud auth login
gcloud auth application-default login
```

## 1. Variáveis

```bash
export ORG_ID="<seu-org-id>"            # gcloud organizations list
export BILLING_ACCOUNT="<billing-id>"   # gcloud beta billing accounts list
export TF_SA_NAME="terraform-deployer"

export PROJECT_STAGING="elosmed-staging"
export PROJECT_PROD="elosmed-prod"

export REGION="southamerica-east1"
```

## 2. Criar projetos

```bash
gcloud projects create "$PROJECT_STAGING" \
  --name="ELOS MED Staging" \
  --organization="$ORG_ID"

gcloud projects create "$PROJECT_PROD" \
  --name="ELOS MED Production" \
  --organization="$ORG_ID"

# Vincular billing
gcloud beta billing projects link "$PROJECT_STAGING" \
  --billing-account="$BILLING_ACCOUNT"

gcloud beta billing projects link "$PROJECT_PROD" \
  --billing-account="$BILLING_ACCOUNT"
```

## 3. Habilitar APIs (em cada projeto)

```bash
APIS=(
  cloudresourcemanager.googleapis.com
  serviceusage.googleapis.com
  iam.googleapis.com
  iamcredentials.googleapis.com
  compute.googleapis.com
  servicenetworking.googleapis.com
  vpcaccess.googleapis.com
  sqladmin.googleapis.com
  redis.googleapis.com
  storage.googleapis.com
  artifactregistry.googleapis.com
  run.googleapis.com
  cloudbuild.googleapis.com
  secretmanager.googleapis.com
  cloudkms.googleapis.com
  dns.googleapis.com
  certificatemanager.googleapis.com
  monitoring.googleapis.com
  logging.googleapis.com
  cloudtrace.googleapis.com
  aiplatform.googleapis.com
  sts.googleapis.com
)

for PROJECT in "$PROJECT_STAGING" "$PROJECT_PROD"; do
  for API in "${APIS[@]}"; do
    gcloud services enable "$API" --project="$PROJECT"
  done
done
```

## 4. Buckets de state do Terraform (um por env)

```bash
for ENV_PROJECT in "$PROJECT_STAGING" "$PROJECT_PROD"; do
  BUCKET="${ENV_PROJECT}-tfstate"
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$ENV_PROJECT" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention

  # Versionamento + retenção
  gcloud storage buckets update "gs://${BUCKET}" --versioning
  gcloud storage buckets update "gs://${BUCKET}" \
    --lifecycle-file=- <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"numNewerVersions": 10, "daysSinceNoncurrentTime": 30}
      }
    ]
  }
}
EOF
done
```

## 5. Service Account do Terraform (uma por env)

```bash
for PROJECT in "$PROJECT_STAGING" "$PROJECT_PROD"; do
  gcloud iam service-accounts create "$TF_SA_NAME" \
    --project="$PROJECT" \
    --display-name="Terraform Deployer"

  TF_SA="${TF_SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

  # Roles necessárias para o TF criar o resto da infra.
  ROLES=(
    roles/owner                               # simplifica bootstrap
    roles/iam.securityAdmin                   # IAM bindings finos
    roles/iam.workloadIdentityPoolAdmin       # WIF para GitHub
  )
  for ROLE in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT" \
      --member="serviceAccount:${TF_SA}" \
      --role="$ROLE" \
      --condition=None
  done
done
```

> ⚠ `roles/owner` é amplo; é aceitável aqui porque o Terraform precisa
> criar SAs e IAM. Em ambiente regulado, troque por uma role custom
> com apenas as permissões necessárias.

## 6. Permitir que sua conta humana use a SA do Terraform

```bash
USER_EMAIL="$(gcloud config get-value account)"

for PROJECT in "$PROJECT_STAGING" "$PROJECT_PROD"; do
  TF_SA="${TF_SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
  gcloud iam service-accounts add-iam-policy-binding "$TF_SA" \
    --project="$PROJECT" \
    --member="user:${USER_EMAIL}" \
    --role="roles/iam.serviceAccountTokenCreator"
done
```

Depois disso, o Terraform usa _impersonation_ — você não baixa chave JSON
nenhuma. O provider `google` lê `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`.

## 7. Verificar

```bash
gcloud config set project "$PROJECT_STAGING"
gcloud auth application-default print-access-token >/dev/null && echo OK
gcloud storage ls "gs://${PROJECT_STAGING}-tfstate"
```

## 8. Próximo passo

```bash
cd ../envs/staging
cp terraform.tfvars.example terraform.tfvars
# editar terraform.tfvars com seus valores
terraform init
terraform plan
```
