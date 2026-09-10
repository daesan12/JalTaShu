#!/usr/bin/env bash
set -Eeuo pipefail

readonly region="${AWS_DEFAULT_REGION:-ap-northeast-2}"
readonly script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly lifecycle_policy="${script_dir}/lifecycle-policy.json"
readonly registry_scanning_config="${script_dir}/registry-scanning-configuration.json"
readonly repositories=(
  "tashu/frontend"
  "tashu/backend"
)

command -v aws >/dev/null 2>&1 || {
  echo "aws CLI를 찾을 수 없습니다." >&2
  exit 1
}

aws sts get-caller-identity >/dev/null

for repository in "${repositories[@]}"; do
  if aws ecr describe-repositories \
    --region "${region}" \
    --repository-names "${repository}" \
    >/dev/null 2>&1; then
    printf '유지: %s\n' "${repository}"
  else
    aws ecr create-repository \
      --region "${region}" \
      --repository-name "${repository}" \
      --image-tag-mutability IMMUTABLE \
      --encryption-configuration encryptionType=AES256 \
      >/dev/null
    printf '생성: %s\n' "${repository}"
  fi

  aws ecr put-lifecycle-policy \
    --region "${region}" \
    --repository-name "${repository}" \
    --lifecycle-policy-text "file://${lifecycle_policy}" \
    >/dev/null
  printf '보관 정책 적용: %s\n' "${repository}"
done

aws ecr put-registry-scanning-configuration \
  --region "${region}" \
  --cli-input-json "file://${registry_scanning_config}" \
  >/dev/null
printf '레지스트리 스캔 정책 적용: tashu/* Push 시 기본 스캔\n'

aws ecr describe-repositories \
  --region "${region}" \
  --repository-names "${repositories[@]}" \
  --query 'repositories[].{name:repositoryName,tagPolicy:imageTagMutability,encryption:encryptionConfiguration.encryptionType}' \
  --output table

aws ecr get-registry-scanning-configuration \
  --region "${region}" \
  --query 'scanningConfiguration.{scanType:scanType,rules:rules}' \
  --output json
