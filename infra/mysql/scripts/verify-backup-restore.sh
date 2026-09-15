#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "사용법: sudo $0 <backup.sql.gz>" >&2
  exit 64
fi

readonly backup_path="$1"
readonly image="${MYSQL_RESTORE_TEST_IMAGE:-mysql:8.4.11}"
readonly container_name="${MYSQL_RESTORE_TEST_CONTAINER:-tashu-mysql-restore-test}"

if [[ ! -f "${backup_path}" ]]; then
  echo "백업 파일을 찾을 수 없습니다: ${backup_path}" >&2
  exit 1
fi

gzip -t "${backup_path}"

if docker container inspect "${container_name}" >/dev/null 2>&1; then
  echo "같은 이름의 컨테이너가 이미 있어 중단합니다: ${container_name}" >&2
  exit 1
fi

cleanup() {
  docker rm -f "${container_name}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d \
  --name "${container_name}" \
  --network none \
  --tmpfs /var/lib/mysql:rw,noexec,nosuid,size=512m \
  -e MYSQL_ALLOW_EMPTY_PASSWORD=yes \
  "${image}" >/dev/null

for attempt in $(seq 1 60); do
  if docker exec "${container_name}" mysqladmin ping -uroot --silent >/dev/null 2>&1; then
    break
  fi
  if [[ "${attempt}" -eq 60 ]]; then
    echo "임시 MySQL 시작 시간이 초과됐습니다." >&2
    exit 1
  fi
  sleep 1
done

gzip -dc "${backup_path}" | docker exec -i "${container_name}" mysql -uroot

readonly restored_databases="$(docker exec "${container_name}" mysql -uroot --batch --skip-column-names \
  -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('tashu_prod','tashu_staging') ORDER BY SCHEMA_NAME;")"
readonly expected_databases=$'tashu_prod\ntashu_staging'

if [[ "${restored_databases}" != "${expected_databases}" ]]; then
  echo "복원된 DB 목록이 예상과 다릅니다." >&2
  printf '%s\n' "${restored_databases}" >&2
  exit 1
fi

printf 'MySQL restore verification completed: %s\n' "${backup_path}"
