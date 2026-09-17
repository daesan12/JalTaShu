#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
fi

if [[ $# -ne 2 ]]; then
  echo '사용법: configure-redis-secret.sh <Redis host> <합의된 DB 번호>' >&2
  exit 1
fi

readonly redis_host="$1"
readonly redis_db="$2"
readonly secret_dir="${TASHU_AI_SECRET_DIR:-/etc/tashu/ai-serving}"
readonly secret_file="${secret_dir}/redis.env"

if [[ ! ${redis_host} =~ ^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\. ]]; then
  echo 'Redis host는 사설 IPv4 주소여야 합니다.' >&2
  exit 1
fi
if [[ ! ${redis_db} =~ ^[0-9]+$ ]]; then
  echo 'Redis DB 번호는 팀에서 합의한 0 이상의 정수여야 합니다.' >&2
  exit 1
fi

read -r -s -p 'Redis password: ' redis_password
printf '\n'
if [[ -z ${redis_password} || ${redis_password} == *$'\n'* ]]; then
  echo 'Redis password가 비어 있거나 올바르지 않습니다.' >&2
  exit 1
fi

install -d -o root -g root -m 0700 "${secret_dir}"
temporary_file="$(mktemp "${secret_dir}/.redis.env.XXXXXX")"
trap 'rm -f -- "${temporary_file}"' EXIT
{
  printf 'TASHU_AI_REDIS_HOST=%s\n' "${redis_host}"
  printf 'TASHU_AI_REDIS_PORT=6379\n'
  printf 'TASHU_AI_REDIS_DB=%s\n' "${redis_db}"
  printf 'TASHU_AI_REDIS_PASSWORD=%s\n' "${redis_password}"
} > "${temporary_file}"
chown root:root "${temporary_file}"
chmod 0600 "${temporary_file}"
mv -f "${temporary_file}" "${secret_file}"
trap - EXIT
unset redis_password

echo "Redis 접속 설정 저장 완료: ${secret_file} (DB ${redis_db})"
stat -c '%A %U:%G %n' "${secret_file}"
echo 'Secret 값은 출력하지 않았습니다.'
