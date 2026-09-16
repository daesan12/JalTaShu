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
readonly writer_password="$(read_secret "${secret_dir}/data-writer-password")"
readonly reader_password="$(read_secret "${secret_dir}/ai-reader-password")"
readonly observer_password="$(read_secret "${secret_dir}/observer-password")"

if ! docker inspect --format '{{.State.Health.Status}}' "${container_name}" 2>/dev/null | grep -qx healthy; then
  echo "MySQL 컨테이너가 healthy 상태가 아닙니다: ${container_name}" >&2
  exit 1
fi

docker exec \
  --env MYSQL_PWD="${root_password}" \
  --interactive "${container_name}" \
  mysql --user=root <<SQL
CREATE DATABASE IF NOT EXISTS \`tashu_data\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'tashu_data_writer'@'%' IDENTIFIED BY '${writer_password}';
ALTER USER 'tashu_data_writer'@'%' IDENTIFIED BY '${writer_password}';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'tashu_data_writer'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE
  ON \`tashu_data\`.* TO 'tashu_data_writer'@'%';

CREATE USER IF NOT EXISTS 'tashu_ai_reader'@'%' IDENTIFIED BY '${reader_password}';
ALTER USER 'tashu_ai_reader'@'%' IDENTIFIED BY '${reader_password}';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'tashu_ai_reader'@'%';
GRANT SELECT
  ON \`tashu_data\`.* TO 'tashu_ai_reader'@'%';

CREATE USER IF NOT EXISTS 'tashu_observer'@'%' IDENTIFIED BY '${observer_password}';
ALTER USER 'tashu_observer'@'%' IDENTIFIED BY '${observer_password}';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'tashu_observer'@'%';
GRANT SELECT ON \`tashu_prod\`.* TO 'tashu_observer'@'%';
GRANT SELECT ON \`tashu_staging\`.* TO 'tashu_observer'@'%';
GRANT SELECT ON \`tashu_data\`.* TO 'tashu_observer'@'%';

FLUSH PRIVILEGES;
SQL

echo "tashu_data DB와 writer/reader/observer 계정을 준비했습니다."
