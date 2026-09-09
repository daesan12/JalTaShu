#!/usr/bin/env bash
set -euo pipefail

readonly secret_dir="${1:-/etc/tashu/mysql}"

install -d -o root -g root -m 0700 "${secret_dir}"
umask 077

for secret_name in root-password prod-password staging-password; do
  secret_path="${secret_dir}/${secret_name}"

  if [[ -e "${secret_path}" ]]; then
    echo "유지: ${secret_path}"
    continue
  fi

  openssl rand -hex 24 > "${secret_path}"
  chown root:root "${secret_path}"
  chmod 0600 "${secret_path}"
  echo "생성: ${secret_path}"
done

echo "비밀번호 값은 출력하지 않았습니다."
