#!/usr/bin/env bash
set -euo pipefail

readonly group_name="tashu-jenkins"
readonly secret_dir="${JENKINS_SECRET_DIR:-/etc/tashu/jenkins}"
readonly client_id_file="${secret_dir}/naver-map-client-id"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 권한으로 실행해야 합니다." >&2
  exit 1
fi

if ! getent group "${group_name}" >/dev/null; then
  echo "${group_name} 그룹이 없습니다. generate-secrets.sh를 먼저 실행하세요." >&2
  exit 1
fi

read -r -s -p "Naver Maps Client ID: " client_id
printf '\n'

if [[ -z "${client_id}" ]]; then
  echo "Client ID는 비어 있을 수 없습니다." >&2
  exit 1
fi

if [[ ! "${client_id}" =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "Client ID 형식이 올바르지 않습니다." >&2
  exit 1
fi

install -d -o root -g "${group_name}" -m 0750 "${secret_dir}"
umask 077
client_id_tmp="$(mktemp "${secret_dir}/.naver-map-client-id.XXXXXX")"
trap 'rm -f "${client_id_tmp:-}"' EXIT

printf '%s' "${client_id}" > "${client_id_tmp}"
unset client_id

chown root:"${group_name}" "${client_id_tmp}"
chmod 0640 "${client_id_tmp}"
mv -f "${client_id_tmp}" "${client_id_file}"
trap - EXIT

printf '저장 완료: %s\n' "${client_id_file}"
stat -c '%A %U:%G %n' "${client_id_file}"
echo "Client ID 값은 출력하지 않았습니다."
