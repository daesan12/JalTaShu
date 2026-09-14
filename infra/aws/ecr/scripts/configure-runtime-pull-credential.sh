#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다: sudo .../configure-runtime-pull-credential.sh' >&2
  exit 1
fi

credential_dir=${TASHU_ECR_CREDENTIAL_DIR:-/etc/tashu/ecr-pull}
credential_file=${credential_dir}/credentials

install -d -o root -g root -m 0700 "${credential_dir}"

read -r -p 'ECR Pull Access Key ID: ' access_key_id
read -r -s -p 'ECR Pull Secret Access Key: ' secret_access_key
printf '\n'

if [[ -z ${access_key_id} || -z ${secret_access_key} ]]; then
  echo 'Access Key ID와 Secret Access Key는 비어 있을 수 없습니다.' >&2
  exit 1
fi

temporary=$(mktemp "${credential_dir}/.credentials.XXXXXX")
cleanup() {
  rm -f "${temporary}"
}
trap cleanup EXIT

{
  printf '[default]\n'
  printf 'aws_access_key_id = %s\n' "${access_key_id}"
  printf 'aws_secret_access_key = %s\n' "${secret_access_key}"
} > "${temporary}"

chown root:root "${temporary}"
chmod 0600 "${temporary}"
mv -f "${temporary}" "${credential_file}"
trap - EXIT

unset access_key_id secret_access_key

echo "저장 완료: ${credential_file}"
stat -c '%A %U:%G %n' "${credential_file}"
echo 'Secret 값은 출력하지 않았습니다.'
