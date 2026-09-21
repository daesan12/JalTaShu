#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
fi

if [[ $# -ne 3 ]]; then
  echo '사용법: deploy-slot.sh <blue|green> <frontend-image> <backend-image>' >&2
  exit 1
fi

readonly slot="$1"
readonly frontend_image="$2"
readonly backend_image="$3"
readonly runtime_dir="${TASHU_PRODUCTION_RUNTIME_DIR:-/opt/tashu/infra/runtime/production}"
readonly backend_env_file="${TASHU_BACKEND_PRODUCTION_ENV_FILE:-/etc/tashu/backend-production/runtime.env}"

case "${slot}" in
  blue)
    readonly frontend_port=28080
    readonly backend_port=28081
    ;;
  green)
    readonly frontend_port=28082
    readonly backend_port=28083
    ;;
  *)
    echo 'slot은 blue 또는 green이어야 합니다.' >&2
    exit 1
    ;;
esac

if [[ ! ${frontend_image} =~ \.dkr\.ecr\.ap-northeast-2\.amazonaws\.com/tashu/frontend:prod-[0-9a-f]{12}$ ]]; then
  echo '허용된 production Frontend ECR image 형식이 아닙니다.' >&2
  exit 1
fi
if [[ ! ${backend_image} =~ \.dkr\.ecr\.ap-northeast-2\.amazonaws\.com/tashu/backend:prod-[0-9a-f]{12}$ ]]; then
  echo '허용된 production Backend ECR image 형식이 아닙니다.' >&2
  exit 1
fi
if [[ ! -s ${backend_env_file} ]]; then
  echo "Backend production 환경파일이 없습니다: ${backend_env_file}" >&2
  exit 1
fi
if ! docker image inspect "${frontend_image}" >/dev/null 2>&1 ||
   ! docker image inspect "${backend_image}" >/dev/null 2>&1; then
  echo '먼저 production ECR image 두 개를 pull해야 합니다.' >&2
  exit 1
fi

cd "${runtime_dir}"
SLOT="${slot}" \
FRONTEND_IMAGE="${frontend_image}" \
BACKEND_IMAGE="${backend_image}" \
FRONTEND_HOST_PORT="${frontend_port}" \
BACKEND_HOST_PORT="${backend_port}" \
BACKEND_ENV_FILE="${backend_env_file}" \
  docker compose \
    --project-name "tashu-production-${slot}" \
    --file compose.yml \
    up -d

echo "Production ${slot} 배포 요청 완료"
