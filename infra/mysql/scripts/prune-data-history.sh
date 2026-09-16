#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${MYSQL_CONTAINER_NAME:-tashu-mysql}"
readonly secret_path="${MYSQL_DATA_WRITER_SECRET:-/etc/tashu/mysql/data-writer-password}"
readonly retention_hours="${MYSQL_DATA_RETENTION_HOURS:-48}"
readonly batch_size="${MYSQL_DATA_PRUNE_BATCH_SIZE:-10000}"
readonly max_batches="${MYSQL_DATA_PRUNE_MAX_BATCHES:-100}"

for numeric_value in "${retention_hours}" "${batch_size}" "${max_batches}"; do
  if [[ ! "${numeric_value}" =~ ^[1-9][0-9]*$ ]]; then
    echo "보존시간, batch 크기와 최대 batch 수는 양의 정수여야 합니다." >&2
    exit 1
  fi
done

if (( retention_hours < 48 )); then
  echo "보존시간은 48시간보다 짧게 설정할 수 없습니다." >&2
  exit 1
fi
if (( batch_size > 50000 )); then
  echo "한 번에 삭제할 행은 50000개를 넘을 수 없습니다." >&2
  exit 1
fi

if [[ ! -r "${secret_path}" ]]; then
  echo "읽을 수 없는 writer Secret: ${secret_path}" >&2
  exit 1
fi

readonly writer_password="$(<"${secret_path}")"
if [[ ! "${writer_password}" =~ ^[0-9a-fA-F]{48}$ ]]; then
  echo "writer Secret 형식이 올바르지 않습니다." >&2
  exit 1
fi

prune_table() {
  local table_name="$1"
  local time_column="$2"
  local total_deleted=0
  local batch_number deleted_rows

  for ((batch_number = 1; batch_number <= max_batches; batch_number++)); do
    deleted_rows="$(
      docker exec \
        --env MYSQL_PWD="${writer_password}" \
        "${container_name}" \
        mysql --protocol=TCP --host=127.0.0.1 --user=tashu_data_writer \
        --database=tashu_data --batch --skip-column-names \
        --execute="
          SET SESSION time_zone = '+00:00';
          DELETE FROM \`${table_name}\`
          WHERE \`${time_column}\` < UTC_TIMESTAMP(6) - INTERVAL ${retention_hours} HOUR
          ORDER BY \`${time_column}\`
          LIMIT ${batch_size};
          SELECT ROW_COUNT();
        "
    )"

    if [[ ! "${deleted_rows}" =~ ^[0-9]+$ ]]; then
      echo "삭제 결과를 해석할 수 없습니다: ${table_name}" >&2
      exit 1
    fi

    total_deleted=$((total_deleted + deleted_rows))
    if (( deleted_rows < batch_size )); then
      break
    fi
    sleep 0.1
  done

  echo "mysql_data_pruned table=${table_name} rows=${total_deleted} retention_hours=${retention_hours}"
}

prune_table station_availability collected_at
prune_table weather_observation observed_at
