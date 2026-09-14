#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
fi

if [[ $# -ne 1 || ! -s $1 ]]; then
  echo '사용법: configure-jenkins-deploy-user.sh <Jenkins deploy public key file>' >&2
  exit 1
fi

readonly public_key_file="$1"
readonly deploy_user="tashu-deploy"
readonly deploy_home="/var/lib/tashu-deploy"
readonly runtime_scripts="/opt/tashu/infra/runtime/backend/scripts"
readonly forced_command="/usr/local/sbin/tashu-ssh-deploy-command"
readonly root_deploy_command="/usr/local/sbin/tashu-jenkins-deploy-staging"
readonly sudoers_file="/etc/sudoers.d/tashu-deploy"

read -r key_type key_value key_comment < "${public_key_file}"
if [[ $(wc -l < "${public_key_file}") -ne 1 || \
      ${key_type:-} != ssh-ed25519 || \
      ! ${key_value:-} =~ ^[A-Za-z0-9+/]+={0,3}$ ]]; then
  echo '올바른 Ed25519 공개키 파일이 아닙니다.' >&2
  exit 1
fi

if ! id "${deploy_user}" >/dev/null 2>&1; then
  useradd \
    --system \
    --create-home \
    --home-dir "${deploy_home}" \
    --shell /bin/bash \
    "${deploy_user}"
fi
passwd --lock "${deploy_user}" >/dev/null

install -o root -g root -m 0755 \
  "${runtime_scripts}/ssh-deploy-command.sh" \
  "${forced_command}"
install -o root -g root -m 0755 \
  "${runtime_scripts}/jenkins-deploy-staging.sh" \
  "${root_deploy_command}"

install -d -o "${deploy_user}" -g "${deploy_user}" -m 0700 "${deploy_home}/.ssh"
temporary_authorized_keys="$(mktemp "${deploy_home}/.ssh/.authorized_keys.XXXXXX")"
temporary_sudoers="$(mktemp /etc/sudoers.d/.tashu-deploy.XXXXXX)"
trap 'rm -f "${temporary_authorized_keys:-}" "${temporary_sudoers:-}"' EXIT

printf 'restrict,command="%s" %s %s\n' \
  "${forced_command}" "${key_type}" "${key_value}" \
  > "${temporary_authorized_keys}"
chown "${deploy_user}:${deploy_user}" "${temporary_authorized_keys}"
chmod 0600 "${temporary_authorized_keys}"
mv -f "${temporary_authorized_keys}" "${deploy_home}/.ssh/authorized_keys"

printf '%s ALL=(root) NOPASSWD: %s\n' \
  "${deploy_user}" "${root_deploy_command}" \
  > "${temporary_sudoers}"
chmod 0440 "${temporary_sudoers}"
visudo --check --file "${temporary_sudoers}" >/dev/null
mv -f "${temporary_sudoers}" "${sudoers_file}"

trap - EXIT

echo "Jenkins staging deploy 사용자 구성 완료: ${deploy_user}"
echo '허용 명령: deploy-backend <12자리 Git SHA>'
echo 'Docker group과 일반 sudo 권한은 부여하지 않았습니다.'
