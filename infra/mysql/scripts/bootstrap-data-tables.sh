#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${MYSQL_CONTAINER_NAME:-tashu-mysql}"
readonly secret_dir="${MYSQL_SECRET_DIR:-/etc/tashu/mysql}"
readonly schema_file="${MYSQL_DATA_SCHEMA_FILE:-/opt/tashu/mysql/schema/tashu-data.sql}"

if [[ ! -r "${secret_dir}/root-password" ]]; then
  echo "읽을 수 없는 MySQL root Secret: ${secret_dir}/root-password" >&2
  exit 1
fi

readonly root_password="$(<"${secret_dir}/root-password")"
if [[ ! "${root_password}" =~ ^[0-9a-fA-F]{48}$ ]]; then
  echo "MySQL root Secret 형식이 올바르지 않습니다." >&2
  exit 1
fi

if [[ ! -r "${schema_file}" ]]; then
  echo "읽을 수 없는 schema 파일: ${schema_file}" >&2
  exit 1
fi

if ! docker inspect --format '{{.State.Health.Status}}' "${container_name}" 2>/dev/null | grep -qx healthy; then
  echo "MySQL 컨테이너가 healthy 상태가 아닙니다: ${container_name}" >&2
  exit 1
fi

docker exec \
  --env MYSQL_PWD="${root_password}" \
  --interactive "${container_name}" \
  mysql --user=root < "${schema_file}"

echo "tashu_data 실시간 이력 테이블을 준비했습니다."
