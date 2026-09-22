#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${MYSQL_CONTAINER_NAME:-tashu-mysql}"
readonly secret_dir="${MYSQL_SECRET_DIR:-/etc/tashu/mysql}"

read_secret() {
  local secret_path="$1"
  local secret_value

  if [[ ! -r "${secret_path}" ]]; then
    echo "읽을 수 없는 Secret 파일: ${secret_path}" >&2
    exit 1
  fi

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

mysql_as() {
  local user_name="$1"
  local password="$2"
  shift 2

  docker exec \
    --env MYSQL_PWD="${password}" \
    "${container_name}" \
    mysql --protocol=TCP --host=127.0.0.1 --user="${user_name}" \
    --batch --skip-column-names "$@"
}

root_sql() {
  docker exec \
    --env MYSQL_PWD="${root_password}" \
    "${container_name}" \
    mysql --user=root --batch --skip-column-names "$@"
}

cleanup() {
  root_sql --execute='DROP TABLE IF EXISTS tashu_data.__infra_permission_probe;' >/dev/null
}
trap cleanup EXIT

root_sql --execute='
  CREATE TABLE IF NOT EXISTS tashu_data.__infra_permission_probe (
    id INT PRIMARY KEY,
    note VARCHAR(32) NOT NULL
  );
  DELETE FROM tashu_data.__infra_permission_probe;
  INSERT INTO tashu_data.__infra_permission_probe (id, note)
  VALUES (1, "root-seed");
' >/dev/null

mysql_as tashu_data_writer "${writer_password}" tashu_data --execute='
  INSERT INTO __infra_permission_probe (id, note) VALUES (2, "writer");
  UPDATE __infra_permission_probe SET note = "writer-updated" WHERE id = 2;
  DELETE FROM __infra_permission_probe WHERE id = 2;
  SELECT COUNT(*) FROM __infra_permission_probe;
' >/dev/null
echo "PASS: data writer의 SELECT/INSERT/UPDATE/DELETE"

if mysql_as tashu_data_writer "${writer_password}" tashu_data \
  --execute='CREATE TABLE __writer_must_not_create (id INT);' >/dev/null 2>&1; then
  echo "FAIL: data writer가 CREATE 권한을 가지고 있습니다." >&2
  exit 1
fi
echo "PASS: data writer의 DDL 차단"

if mysql_as tashu_data_writer "${writer_password}" tashu_prod \
  --execute='SELECT 1;' >/dev/null 2>&1; then
  echo "FAIL: data writer가 tashu_prod에 접근했습니다." >&2
  exit 1
fi
echo "PASS: data writer의 애플리케이션 DB 접근 차단"

mysql_as tashu_ai_reader "${reader_password}" tashu_data \
  --execute='SELECT COUNT(*) FROM __infra_permission_probe;' >/dev/null
echo "PASS: AI reader의 tashu_data 읽기"

if mysql_as tashu_ai_reader "${reader_password}" tashu_data \
  --execute='UPDATE __infra_permission_probe SET note = "forbidden" WHERE id = 1;' >/dev/null 2>&1; then
  echo "FAIL: AI reader가 데이터를 수정했습니다." >&2
  exit 1
fi
echo "PASS: AI reader의 쓰기 차단"

for database_name in tashu_prod tashu_staging tashu_data; do
  mysql_as tashu_observer "${observer_password}" "${database_name}" \
    --execute='SELECT 1;' >/dev/null
done
echo "PASS: observer의 prod/staging/data 읽기"

if mysql_as tashu_observer "${observer_password}" tashu_data \
  --execute='UPDATE __infra_permission_probe SET note = "forbidden" WHERE id = 1;' >/dev/null 2>&1; then
  echo "FAIL: observer가 데이터를 수정했습니다." >&2
  exit 1
fi
echo "PASS: observer의 쓰기 차단"

echo "모든 tashu_data 계정 분리 검증을 통과했습니다."
