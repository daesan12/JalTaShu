#!/usr/bin/env bash
set -euo pipefail

readonly group_name="tashu-jenkins"
readonly secret_dir="${JENKINS_SECRET_DIR:-/etc/tashu/jenkins}"
readonly access_key_file="${secret_dir}/aws-ecr-access-key-id"
readonly secret_key_file="${secret_dir}/aws-ecr-secret-access-key"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 권한으로 실행해야 합니다." >&2
  exit 1
fi

if ! getent group "${group_name}" >/dev/null; then
  echo "${group_name} 그룹이 없습니다. generate-secrets.sh를 먼저 실행하세요." >&2
  exit 1
fi

read -r -p "AWS ECR Push Access Key ID: " access_key_id
read -r -s -p "AWS ECR Push Secret Access Key: " secret_access_key
printf '\n'

if [[ -z "${access_key_id}" || -z "${secret_access_key}" ]]; then
  echo "Access Key ID와 Secret Access Key는 비어 있을 수 없습니다." >&2
  exit 1
fi

install -d -o root -g "${group_name}" -m 0750 "${secret_dir}"
umask 077
access_key_tmp="$(mktemp "${secret_dir}/.aws-ecr-access-key-id.XXXXXX")"
secret_key_tmp="$(mktemp "${secret_dir}/.aws-ecr-secret-access-key.XXXXXX")"
trap 'rm -f "${access_key_tmp:-}" "${secret_key_tmp:-}"' EXIT

printf '%s' "${access_key_id}" > "${access_key_tmp}"
printf '%s' "${secret_access_key}" > "${secret_key_tmp}"
unset access_key_id secret_access_key

chown root:"${group_name}" "${access_key_tmp}" "${secret_key_tmp}"
chmod 0640 "${access_key_tmp}" "${secret_key_tmp}"
mv -f "${access_key_tmp}" "${access_key_file}"
mv -f "${secret_key_tmp}" "${secret_key_file}"
trap - EXIT

printf '저장 완료: %s, %s\n' "${access_key_file}" "${secret_key_file}"
stat -c '%A %U:%G %n' "${access_key_file}" "${secret_key_file}"
echo "Secret 값은 출력하지 않았습니다."
