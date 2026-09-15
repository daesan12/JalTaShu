#!/usr/bin/env bash
set -euo pipefail

read -r action argument extra <<< "${SSH_ORIGINAL_COMMAND:-}"

case "${action:-}" in
  deploy-backend)
    [[ ${argument:-} =~ ^[0-9a-f]{12}$ && -z ${extra:-} ]] || exit 1
    exec sudo -n /usr/local/sbin/tashu-jenkins-deploy-staging "${argument}"
    ;;
  deploy-frontend)
    [[ ${argument:-} =~ ^[0-9a-f]{12}$ && -z ${extra:-} ]] || exit 1
    exec sudo -n /usr/local/sbin/tashu-jenkins-deploy-frontend-staging "${argument}"
    ;;
  prepare-production)
    [[ ${argument:-} =~ ^[0-9a-f]{12}$ && -z ${extra:-} ]] || exit 1
    exec sudo -n /usr/local/sbin/tashu-jenkins-production prepare "${argument}"
    ;;
  activate-production)
    [[ ${argument:-} =~ ^[0-9a-f]{12}$ && -z ${extra:-} ]] || exit 1
    exec sudo -n /usr/local/sbin/tashu-jenkins-production activate "${argument}"
    ;;
  rollback-production)
    [[ -z ${argument:-} && -z ${extra:-} ]] || exit 1
    exec sudo -n /usr/local/sbin/tashu-jenkins-production rollback
    ;;
  *)
    echo '허용되지 않은 배포 명령입니다.' >&2
    exit 1
    ;;
esac
