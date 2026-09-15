#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
fi

if [[ $# -ne 1 || ! $1 =~ ^[0-9a-f]{12}$ ]]; then
  echo '사용법: jenkins-deploy-staging.sh <12자리 Git SHA>' >&2
  exit 1
fi

readonly image_tag="$1"
readonly region="ap-northeast-2"
readonly credential_file="/etc/tashu/ecr-pull/credentials"
readonly pull_script="/opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh"
readonly deploy_script="/opt/tashu/infra/runtime/backend/scripts/deploy-staging.sh"
readonly container_name="tashu-backend-staging"
readonly lock_file="/run/lock/tashu-backend-staging-deploy.lock"

wait_for_health() {
  local attempt
  local health

  for attempt in $(seq 1 30); do
    health="$(docker inspect --format '{{.State.Health.Status}}' "${container_name}" 2>/dev/null || true)"
    if [[ ${health} == healthy ]]; then
      curl --fail --silent --show-error \
        http://127.0.0.1:18081/api/actuator/health \
        | grep -q '"status":"UP"'
      return 0
    fi
    if [[ ${health} == unhealthy ]]; then
      return 1
    fi
    sleep 4
  done
  return 1
}

for required_file in "${credential_file}" "${pull_script}" "${deploy_script}"; do
  if [[ ! -e ${required_file} ]]; then
    echo "필수 배포 파일이 없습니다: ${required_file}" >&2
    exit 1
  fi
done

exec 9>"${lock_file}"
if ! flock --nonblock 9; then
  echo '다른 Backend staging 배포가 진행 중입니다.' >&2
  exit 1
fi

export AWS_SHARED_CREDENTIALS_FILE="${credential_file}"
export AWS_EC2_METADATA_DISABLED=true
export AWS_PAGER=''

account_id="$(aws sts get-caller-identity --query Account --output text)"
readonly new_image="${account_id}.dkr.ecr.${region}.amazonaws.com/tashu/backend:${image_tag}"
previous_image="$(docker inspect --format '{{.Config.Image}}' "${container_name}" 2>/dev/null || true)"

echo "배포 시작: tashu/backend:${image_tag}"
"${pull_script}" tashu/backend "${image_tag}"
"${deploy_script}" "${new_image}"

if wait_for_health; then
  echo "배포 성공: tashu/backend:${image_tag} health=UP"
  exit 0
fi

echo "배포 실패: tashu/backend:${image_tag}" >&2

if [[ -n ${previous_image} && ${previous_image} != "${new_image}" ]]; then
  echo '이전 staging image로 복구합니다.' >&2
  "${deploy_script}" "${previous_image}"
  if wait_for_health; then
    echo "복구 성공: ${previous_image}" >&2
  else
    echo '이전 staging image 복구도 실패했습니다.' >&2
  fi
fi

exit 1
