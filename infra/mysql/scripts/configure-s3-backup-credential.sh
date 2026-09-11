#!/usr/bin/env bash
set -Eeuo pipefail

readonly credential_dir='/etc/tashu/mysql-backup'
readonly credential_path="${credential_dir}/aws-credentials"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 권한으로 실행해야 합니다: sudo $0" >&2
  exit 1
fi

read -r -p 'MySQL Backup S3 Access Key ID: ' access_key_id
read -r -s -p 'MySQL Backup S3 Secret Access Key: ' secret_access_key
printf '\n'

if [[ -z "${access_key_id}" || -z "${secret_access_key}" ]]; then
  echo "Access Key ID와 Secret Access Key를 모두 입력해야 합니다." >&2
  exit 1
fi

install -d -o root -g root -m 0700 "${credential_dir}"
umask 077

credential_tmp="$(mktemp "${credential_dir}/aws-credentials.XXXXXX")"
cleanup() {
  rm -f -- "${credential_tmp}"
}
trap cleanup EXIT

cat > "${credential_tmp}" <<EOF
[default]
aws_access_key_id = ${access_key_id}
aws_secret_access_key = ${secret_access_key}
EOF

chown root:root "${credential_tmp}"
chmod 0600 "${credential_tmp}"
mv "${credential_tmp}" "${credential_path}"

unset access_key_id secret_access_key
echo "저장 완료: ${credential_path}"
stat -c '%A %U:%G %n' "${credential_path}"
echo 'Secret 값은 출력하지 않았습니다.'
