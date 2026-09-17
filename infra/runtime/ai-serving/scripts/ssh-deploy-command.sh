#!/usr/bin/env bash
set -Eeuo pipefail

read -r action image_tag extra <<< "${SSH_ORIGINAL_COMMAND:-}"
if [[ ${action:-} != deploy-ai-serving || ! ${image_tag:-} =~ ^[0-9a-f]{12}$ || -n ${extra:-} ]]; then
  echo '허용되지 않은 배포 명령입니다.' >&2
  exit 1
fi

exec sudo -n /usr/local/sbin/tashu-jenkins-deploy-ai-serving "${image_tag}"
