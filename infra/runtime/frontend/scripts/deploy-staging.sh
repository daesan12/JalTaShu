#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "사용법: $0 <full-ecr-frontend-image-uri>" >&2
  exit 1
fi

readonly frontend_image="$1"
readonly runtime_dir="${TASHU_FRONTEND_RUNTIME_DIR:-/opt/tashu/infra/runtime/frontend}"

if [[ "${frontend_image}" != *.dkr.ecr.ap-northeast-2.amazonaws.com/tashu/frontend:* ]]; then
  echo '서울 리전의 tashu/frontend ECR image만 배포할 수 있습니다.' >&2
  exit 1
fi

if ! docker image inspect "${frontend_image}" >/dev/null 2>&1; then
  echo "먼저 ECR image를 pull해야 합니다: ${frontend_image}" >&2
  exit 1
fi

cd "${runtime_dir}"
FRONTEND_IMAGE="${frontend_image}" \
  docker compose --file compose.staging.yml up -d

echo "Frontend staging 배포 요청 완료: ${frontend_image}"
