#!/usr/bin/env bash
set -euo pipefail

readonly secret_dir="${TASHU_REDIS_SECRET_DIR:-/etc/tashu/redis}"
readonly runtime_env="${secret_dir}/runtime.env"

install -d -o root -g root -m 0700 "${secret_dir}"

if [[ -s "${runtime_env}" ]]; then
  echo "유지: ${runtime_env}"
  stat -c '%A %U:%G %n' "${runtime_env}"
  echo '기존 Redis Secret 값을 변경하지 않았습니다.'
  exit 0
fi

password="$(openssl rand -hex 32)"
temporary_file="$(mktemp "${secret_dir}/.runtime.env.XXXXXX")"
trap 'rm -f "${temporary_file:-}"; unset password' EXIT

printf 'REDIS_PASSWORD=%s\n' "${password}" > "${temporary_file}"
chown root:root "${temporary_file}"
chmod 0600 "${temporary_file}"
mv -f "${temporary_file}" "${runtime_env}"

unset password
trap - EXIT

echo "생성: ${runtime_env}"
stat -c '%A %U:%G %n' "${runtime_env}"
echo 'Secret 값은 출력하지 않았습니다.'
