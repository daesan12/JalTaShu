#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  echo "root 권한으로 실행하세요: sudo $0" >&2
  exit 1
fi

readonly target_dir=/etc/tashu/streaming
readonly target_file="${target_dir}/mysql-data-writer.env"

if [[ -t 0 ]]; then
  read -r -s -p 'MySQL data writer password: ' writer_password
  echo
else
  IFS= read -r writer_password
fi

if [[ ! "${writer_password}" =~ ^[0-9a-fA-F]{48}$ ]]; then
  echo "예상한 48자리 hex 비밀번호 형식이 아닙니다." >&2
  exit 1
fi

install -d -o root -g root -m 0700 "${target_dir}"
temp_file="$(mktemp "${target_dir}/.mysql-data-writer.env.XXXXXX")"
trap 'rm -f "${temp_file}"' EXIT

cat > "${temp_file}" <<EOF
TASHU_DATA_DB_JDBC_URL=jdbc:mysql://172.26.8.114:3306/tashu_data?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&useSSL=false&allowPublicKeyRetrieval=true
TASHU_DATA_DB_USER=tashu_data_writer
TASHU_DATA_DB_PASSWORD=${writer_password}
TASHU_DATA_DB_DRIVER=com.mysql.cj.jdbc.Driver
EOF

chown root:root "${temp_file}"
chmod 0600 "${temp_file}"
mv -f "${temp_file}" "${target_file}"
trap - EXIT
unset writer_password

echo "저장 완료: ${target_file}"
stat -c '%A %U:%G %n' "${target_file}"
echo "Secret 값은 출력하지 않았습니다."
