#!/usr/bin/env bash
set -Eeuo pipefail

readonly source_dir="${MYSQL_BACKUP_DIR:-/srv/tashu/backups/mysql}"
readonly destination="${MYSQL_BACKUP_S3_URI:-s3://s15p21b103-tashu-datalake/backups/mysql/}"

if [[ ! -d "${source_dir}" ]]; then
  echo "MySQL 백업 디렉터리를 찾을 수 없습니다: ${source_dir}" >&2
  exit 1
fi

if [[ ! -r "${AWS_SHARED_CREDENTIALS_FILE:-}" ]]; then
  echo "S3 백업 자격증명 파일을 읽을 수 없습니다." >&2
  exit 1
fi

shopt -s nullglob
backup_files=("${source_dir}"/tashu-mysql-*.sql.gz)

if (( ${#backup_files[@]} == 0 )); then
  echo "업로드할 MySQL 백업 파일이 없습니다." >&2
  exit 1
fi

for backup_path in "${backup_files[@]}"; do
  checksum_path="${backup_path}.sha256"
  if [[ ! -f "${checksum_path}" ]]; then
    echo "checksum 파일이 없습니다: ${checksum_path}" >&2
    exit 1
  fi

  (
    cd "${source_dir}"
    sha256sum --check "$(basename "${checksum_path}")" >/dev/null
  )
done

started_at="$(date +%s)"
echo "S3 upload started: verified_backups=${#backup_files[@]}"

/usr/local/bin/aws s3 sync \
  "${source_dir}/" \
  "${destination}" \
  --exclude '*' \
  --include 'tashu-mysql-*.sql.gz' \
  --include 'tashu-mysql-*.sql.gz.sha256' \
  --only-show-errors

duration="$(( $(date +%s) - started_at ))"
echo "S3 upload completed: verified_backups=${#backup_files[@]} duration_seconds=${duration}"
