#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${MYSQL_CONTAINER_NAME:-tashu-mysql}"
readonly secret_dir="${MYSQL_SECRET_DIR:-/etc/tashu/mysql}"
readonly prune_script="${MYSQL_DATA_PRUNE_SCRIPT:-/usr/local/sbin/tashu-mysql-prune-data-history}"

read_secret() {
  local secret_path="$1"
  local secret_value
  secret_value="$(<"${secret_path}")"
  [[ "${secret_value}" =~ ^[0-9a-fA-F]{48}$ ]] || return 1
  printf '%s' "${secret_value}"
}

readonly writer_password="$(read_secret "${secret_dir}/data-writer-password")"
readonly observer_password="$(read_secret "${secret_dir}/observer-password")"

mysql_as() {
  local user_name="$1"
  local password="$2"
  shift 2
  docker exec --env MYSQL_PWD="${password}" "${container_name}" \
    mysql --protocol=TCP --host=127.0.0.1 --user="${user_name}" \
    --database=tashu_data --batch --skip-column-names "$@"
}

cleanup() {
  mysql_as tashu_data_writer "${writer_password}" --execute="
    DELETE FROM station_availability WHERE event_id LIKE '__infra_%';
    DELETE FROM weather_observation WHERE event_id LIKE '__infra_%';
  " >/dev/null || true
}
trap cleanup EXIT

mysql_as tashu_data_writer "${writer_password}" --execute="
  SET SESSION time_zone = '+00:00';
  INSERT INTO station_availability
    (event_id, schema_version, snapshot_id, station_count, collected_at,
     station_id, station_name, lat, lon, bikes)
  VALUES
    ('__infra_station_old', 1, '__infra_snapshot_old', 1,
     UTC_TIMESTAMP(6) - INTERVAL 49 HOUR, '__infra_station', '검증용', 0, 0, 0),
    ('__infra_station_recent', 1, '__infra_snapshot_recent', 1,
     UTC_TIMESTAMP(6), '__infra_station', '검증용', 0, 0, 0)
  ON DUPLICATE KEY UPDATE bikes = VALUES(bikes);

  INSERT INTO weather_observation
    (event_id, schema_version, observed_at, fetched_at, nx, ny,
     temperature, rainfall_1h, source)
  VALUES
    ('__infra_weather_old', 1, UTC_TIMESTAMP(6) - INTERVAL 49 HOUR,
     UTC_TIMESTAMP(6) - INTERVAL 49 HOUR, 1, 1, 0, 0, '__infra'),
    ('__infra_weather_recent', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6),
     1, 1, 0, 0, '__infra')
  ON DUPLICATE KEY UPDATE temperature = VALUES(temperature);
" >/dev/null

MYSQL_DATA_PRUNE_BATCH_SIZE=1000 "${prune_script}" >/dev/null

readonly old_count="$(mysql_as tashu_observer "${observer_password}" --execute="
  SELECT
    (SELECT COUNT(*) FROM station_availability WHERE event_id = '__infra_station_old') +
    (SELECT COUNT(*) FROM weather_observation WHERE event_id = '__infra_weather_old');
")"
readonly recent_count="$(mysql_as tashu_observer "${observer_password}" --execute="
  SELECT
    (SELECT COUNT(*) FROM station_availability WHERE event_id = '__infra_station_recent') +
    (SELECT COUNT(*) FROM weather_observation WHERE event_id = '__infra_weather_recent');
")"

[[ "${old_count}" == "0" ]] || { echo "FAIL: 48시간 초과 검증 행이 남았습니다." >&2; exit 1; }
[[ "${recent_count}" == "2" ]] || { echo "FAIL: 최근 검증 행이 보존되지 않았습니다." >&2; exit 1; }

echo "PASS: 확정 DDL로 두 테이블 생성"
echo "PASS: writer upsert와 observer 조회"
echo "PASS: 48시간 초과 행만 batch 삭제"
