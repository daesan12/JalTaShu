#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${MYSQL_CONTAINER_NAME:-tashu-mysql}"
readonly secret_dir="${MYSQL_SECRET_DIR:-/etc/tashu/mysql}"

read_secret() {
  local secret_path="$1"

  if [[ ! -r "${secret_path}" ]]; then
    echo "읽을 수 없는 Secret 파일: ${secret_path}" >&2
    exit 1
  fi

  local secret_value
  secret_value="$(<"${secret_path}")"

  if [[ ! "${secret_value}" =~ ^[0-9a-fA-F]{48}$ ]]; then
    echo "예상한 48자리 hex 형식이 아닌 Secret: ${secret_path}" >&2
    exit 1
  fi

  printf '%s' "${secret_value}"
}

readonly root_password="$(read_secret "${secret_dir}/root-password")"
readonly prod_password="$(read_secret "${secret_dir}/prod-password")"
readonly staging_password="$(read_secret "${secret_dir}/staging-password")"

if ! docker inspect --format '{{.State.Health.Status}}' "${container_name}" 2>/dev/null | grep -qx healthy; then
  echo "MySQL 컨테이너가 healthy 상태가 아닙니다: ${container_name}" >&2
  exit 1
fi

docker exec \
  --env MYSQL_PWD="${root_password}" \
  --interactive "${container_name}" \
  mysql --user=root <<SQL
CREATE DATABASE IF NOT EXISTS \`tashu_prod\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS \`tashu_staging\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'tashu_prod_user'@'%' IDENTIFIED BY '${prod_password}';
ALTER USER 'tashu_prod_user'@'%' IDENTIFIED BY '${prod_password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES,
  CREATE TEMPORARY TABLES ON \`tashu_prod\`.* TO 'tashu_prod_user'@'%';

CREATE USER IF NOT EXISTS 'tashu_staging_user'@'%' IDENTIFIED BY '${staging_password}';
ALTER USER 'tashu_staging_user'@'%' IDENTIFIED BY '${staging_password}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES,
  CREATE TEMPORARY TABLES ON \`tashu_staging\`.* TO 'tashu_staging_user'@'%';

FLUSH PRIVILEGES;
SQL

echo "MySQL production/staging DB와 전용 사용자를 준비했습니다."
