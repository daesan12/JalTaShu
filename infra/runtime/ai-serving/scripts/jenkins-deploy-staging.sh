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
readonly sync_script="/opt/tashu/infra/runtime/ai-serving/scripts/sync-models.sh"
readonly deploy_script="/opt/tashu/infra/runtime/ai-serving/scripts/deploy-staging.sh"
readonly container_name="tashu-ai-serving"
readonly lock_file="/run/lock/tashu-ai-serving-deploy.lock"

wait_for_health() {
  local attempt health
  for attempt in $(seq 1 30); do
    health="$(docker inspect --format '{{.State.Health.Status}}' "${container_name}" 2>/dev/null || true)"
    if [[ ${health} == healthy ]]; then
      sleep 5
      [[ $(docker inspect --format '{{.State.Status}}' "${container_name}") == running ]]
      return
    fi
    if [[ ${health} == unhealthy ]]; then
      return 1
    fi
    sleep 4
  done
  return 1
}

for required_file in "${credential_file}" "${pull_script}" "${sync_script}" "${deploy_script}"; do
  if [[ ! -e ${required_file} ]]; then
    echo "필수 배포 파일이 없습니다: ${required_file}" >&2
    exit 1
  fi
done

exec 9>"${lock_file}"
if ! flock --nonblock 9; then
  echo '다른 AI serving 배포가 진행 중입니다.' >&2
  exit 1
fi

export AWS_SHARED_CREDENTIALS_FILE="${credential_file}"
export AWS_EC2_METADATA_DISABLED=true AWS_PAGER=''
account_id="$(aws sts get-caller-identity --query Account --output text)"
readonly new_image="${account_id}.dkr.ecr.${region}.amazonaws.com/tashu/ai:${image_tag}"
previous_image="$(docker inspect --format '{{.Config.Image}}' "${container_name}" 2>/dev/null || true)"

echo "배포 시작: tashu/ai:${image_tag}"
"${sync_script}"
"${pull_script}" tashu/ai "${image_tag}"

if "${deploy_script}" "${new_image}" && wait_for_health; then
  docker logs --tail 20 "${container_name}" 2>&1 | sed -E 's/(PASSWORD|SECRET|TOKEN|KEY)=[^ ]+/\1=***/g'
  echo "배포 성공: tashu/ai:${image_tag}"
  exit 0
fi

echo "배포 실패: tashu/ai:${image_tag}" >&2
docker logs --tail 50 "${container_name}" 2>&1 | sed -E 's/(PASSWORD|SECRET|TOKEN|KEY)=[^ ]+/\1=***/g' >&2 || true

if [[ -n ${previous_image} && ${previous_image} != "${new_image}" ]]; then
  echo '이전 AI serving image로 복구합니다.' >&2
  if "${deploy_script}" "${previous_image}" && wait_for_health; then
    echo "복구 성공: ${previous_image}" >&2
  else
    echo '이전 AI serving image 복구도 실패했습니다.' >&2
  fi
fi

exit 1
