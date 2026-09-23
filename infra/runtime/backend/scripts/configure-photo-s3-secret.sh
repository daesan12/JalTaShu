#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행하세요.' >&2
  exit 1
fi

readonly secret_dir="${TASHU_BACKEND_COMMON_SECRET_DIR:-/etc/tashu/backend-common}"
readonly secret_file="${TASHU_PHOTO_S3_ENV_FILE:-${secret_dir}/photo-s3.env}"

read -r -p 'Photo S3 Access Key ID: ' access_key_id
read -r -s -p 'Photo S3 Secret Access Key: ' secret_access_key
printf '\n'
read -r -p 'Photo S3 AWS Region: ' aws_region
read -r -p 'Photo S3 Bucket: ' s3_bucket

if [[ -z ${access_key_id} || -z ${secret_access_key} || -z ${aws_region} || -z ${s3_bucket} ]]; then
  echo 'Access Key ID, Secret Access Key, Region, Bucket을 모두 입력해야 합니다.' >&2
  exit 1
fi
if [[ ! ${aws_region} =~ ^[a-z0-9-]+$ ]]; then
  echo 'AWS Region 형식이 올바르지 않습니다.' >&2
  exit 1
fi
if [[ ! ${s3_bucket} =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
  echo 'S3 Bucket 이름 형식이 올바르지 않습니다.' >&2
  exit 1
fi

install -d -o root -g root -m 0700 "${secret_dir}"
temporary_file="$(mktemp "${secret_dir}/.photo-s3.env.XXXXXX")"
trap 'rm -f "${temporary_file:-}"; unset access_key_id secret_access_key aws_region s3_bucket' EXIT

{
  printf 'AWS_ACCESS_KEY_ID=%s\n' "${access_key_id}"
  printf 'AWS_SECRET_ACCESS_KEY=%s\n' "${secret_access_key}"
  printf 'AWS_REGION=%s\n' "${aws_region}"
  printf 'S3_BUCKET=%s\n' "${s3_bucket}"
} > "${temporary_file}"

chown root:root "${temporary_file}"
chmod 0600 "${temporary_file}"
mv -f "${temporary_file}" "${secret_file}"

unset access_key_id secret_access_key aws_region s3_bucket
trap - EXIT

echo "Photo S3 Secret 저장 완료: ${secret_file}"
stat -c '%A %U:%G %n' "${secret_file}"
echo 'Secret 값은 출력하지 않았습니다.'
