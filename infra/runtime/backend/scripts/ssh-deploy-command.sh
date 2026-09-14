#!/usr/bin/env bash
set -euo pipefail

read -r action image_tag extra <<< "${SSH_ORIGINAL_COMMAND:-}"

if [[ ! ${image_tag:-} =~ ^[0-9a-f]{12}$ || -n ${extra:-} ]]; then
  echo '허용되지 않은 배포 명령입니다.' >&2
  exit 1
fi

case "${action:-}" in
  deploy-backend)
    exec sudo -n /usr/local/sbin/tashu-jenkins-deploy-staging "${image_tag}"
    ;;
  deploy-frontend)
    exec sudo -n /usr/local/sbin/tashu-jenkins-deploy-frontend-staging "${image_tag}"
    ;;
  *)
    echo '허용되지 않은 배포 명령입니다.' >&2
    exit 1
    ;;
esac
