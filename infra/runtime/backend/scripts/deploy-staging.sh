#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "사용법: $0 <full-ecr-backend-image-uri>" >&2
  exit 1
fi

readonly backend_image="$1"
readonly runtime_dir="${TASHU_BACKEND_RUNTIME_DIR:-/opt/tashu/infra/runtime/backend}"
readonly backend_env_file="${TASHU_BACKEND_ENV_FILE:-/etc/tashu/backend-staging/runtime.env}"

if [[ "${backend_image}" != *.dkr.ecr.ap-northeast-2.amazonaws.com/tashu/backend:* ]]; then
  echo '서울 리전의 tashu/backend ECR image만 배포할 수 있습니다.' >&2
  exit 1
fi

if [[ ! -s "${backend_env_file}" ]]; then
  echo "Backend staging 환경파일이 없습니다: ${backend_env_file}" >&2
  exit 1
fi

if ! docker image inspect "${backend_image}" >/dev/null 2>&1; then
  echo "먼저 ECR image를 pull해야 합니다: ${backend_image}" >&2
  exit 1
fi

cd "${runtime_dir}"
BACKEND_IMAGE="${backend_image}" \
BACKEND_ENV_FILE="${backend_env_file}" \
  docker compose --file compose.staging.yml up -d

echo "Backend staging 배포 요청 완료: ${backend_image}"
