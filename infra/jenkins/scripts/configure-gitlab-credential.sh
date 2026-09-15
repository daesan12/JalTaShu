#!/usr/bin/env bash
set -euo pipefail

readonly group_name="tashu-jenkins"
readonly secret_dir="${JENKINS_SECRET_DIR:-/etc/tashu/jenkins}"
readonly username_file="${secret_dir}/gitlab-username"
readonly token_file="${secret_dir}/gitlab-token"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 권한으로 실행해야 합니다." >&2
  exit 1
fi

if ! getent group "${group_name}" >/dev/null; then
  echo "${group_name} 그룹이 없습니다. generate-secrets.sh를 먼저 실행하세요." >&2
  exit 1
fi

read -r -p "GitLab Deploy Token username: " gitlab_username
read -r -s -p "GitLab Deploy Token: " gitlab_token
printf '\n'

if [[ -z "${gitlab_username}" || -z "${gitlab_token}" ]]; then
  echo "username과 token은 비어 있을 수 없습니다." >&2
  exit 1
fi

install -d -o root -g "${group_name}" -m 0750 "${secret_dir}"
umask 077
username_tmp="$(mktemp "${secret_dir}/.gitlab-username.XXXXXX")"
token_tmp="$(mktemp "${secret_dir}/.gitlab-token.XXXXXX")"
trap 'rm -f "${username_tmp:-}" "${token_tmp:-}"' EXIT

printf '%s' "${gitlab_username}" > "${username_tmp}"
printf '%s' "${gitlab_token}" > "${token_tmp}"
unset gitlab_username gitlab_token

chown root:"${group_name}" "${username_tmp}" "${token_tmp}"
chmod 0640 "${username_tmp}" "${token_tmp}"
mv -f "${username_tmp}" "${username_file}"
mv -f "${token_tmp}" "${token_file}"
trap - EXIT

printf '저장 완료: %s, %s\n' "${username_file}" "${token_file}"
stat -c '%A %U:%G %n' "${username_file}" "${token_file}"
echo "Secret 값은 출력하지 않았습니다."
