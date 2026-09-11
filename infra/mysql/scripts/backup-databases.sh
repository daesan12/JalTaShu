#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${MYSQL_CONTAINER_NAME:-tashu-mysql}"
readonly backup_dir="${MYSQL_BACKUP_DIR:-/srv/tashu/backups/mysql}"
readonly retention_days="${MYSQL_BACKUP_RETENTION_DAYS:-7}"

if [[ ! "${retention_days}" =~ ^[1-9][0-9]*$ ]]; then
  echo "MYSQL_BACKUP_RETENTION_DAYS는 1 이상의 정수여야 합니다." >&2
  exit 1
fi

readonly retention_minutes=$((${retention_days} * 1440))

install -d -o root -g root -m 0750 "${backup_dir}"

exec 9>/run/lock/tashu-mysql-backup.lock
if ! flock -n 9; then
  echo "다른 MySQL 백업이 실행 중이므로 이번 실행을 건너뜁니다."
  exit 75
fi

readonly health="$(docker inspect --format '{{.State.Health.Status}}' "${container_name}" 2>/dev/null || true)"
if [[ "${health}" != "healthy" ]]; then
  echo "MySQL 컨테이너가 healthy 상태가 아닙니다: ${container_name} (state=${health:-missing})" >&2
  exit 1
fi

readonly timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
readonly backup_name="tashu-mysql-${timestamp}.sql.gz"
readonly backup_path="${backup_dir}/${backup_name}"
readonly backup_tmp="${backup_path}.tmp"
readonly checksum_path="${backup_path}.sha256"
readonly checksum_tmp="${checksum_path}.tmp"

cleanup() {
  rm -f -- "${backup_tmp}" "${checksum_tmp}"
}
trap cleanup EXIT

docker exec "${container_name}" sh -ec '
  MYSQL_PWD="$(cat /run/secrets/mysql_root_password)"
  export MYSQL_PWD
  exec mysqldump \
    --user=root \
    --single-transaction \
    --quick \
    --routines \
    --events \
    --triggers \
    --set-gtid-purged=OFF \
    --no-tablespaces \
    --databases tashu_prod tashu_staging
' | gzip -9 > "${backup_tmp}"

test -s "${backup_tmp}"
gzip -t "${backup_tmp}"
chmod 0640 "${backup_tmp}"
mv "${backup_tmp}" "${backup_path}"

readonly checksum="$(sha256sum "${backup_path}" | awk '{print $1}')"
printf '%s  %s\n' "${checksum}" "${backup_name}" > "${checksum_tmp}"
chmod 0640 "${checksum_tmp}"
mv "${checksum_tmp}" "${checksum_path}"

find "${backup_dir}" -maxdepth 1 -type f \
  \( -name 'tashu-mysql-*.sql.gz' -o -name 'tashu-mysql-*.sql.gz.sha256' \) \
  -mmin +"${retention_minutes}" -delete

printf 'MySQL backup completed: %s bytes=%s\n' "${backup_path}" "$(stat -c %s "${backup_path}")"
