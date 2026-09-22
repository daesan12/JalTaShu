#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  echo "root 권한으로 실행하세요: sudo $0" >&2
  exit 1
fi

readonly RUNTIME_DIR="${TASHU_OSRM_RUNTIME_DIR:-/opt/tashu/osrm}"
readonly COMPOSE_FILE="$RUNTIME_DIR/compose.yml"
readonly NETWORK_NAME="${TASHU_APP_NETWORK:-tashu-app}"
readonly IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
readonly START_LON=127.3845
readonly START_LAT=36.3504
readonly END_LON=127.4000
readonly END_LAT=36.3600

test -f "$COMPOSE_FILE"
docker network inspect "$NETWORK_NAME" >/dev/null

for profile in foot bicycle uphill; do
  test -d "$RUNTIME_DIR/data/$profile"
  test -s "$RUNTIME_DIR/data/$profile/map.osrm.properties"
  test -s "$RUNTIME_DIR/data/$profile/map.osrm.partition"
  test -s "$RUNTIME_DIR/data/$profile/map.osrm.cells"
done

test -r "$RUNTIME_DIR/osrm-uphill/dem/metadata.json"
test -r "$RUNTIME_DIR/osrm-uphill/dem/elevation.asc"

cd "$RUNTIME_DIR"
docker compose --file "$COMPOSE_FILE" pull

for profile in foot bicycle uphill; do
  echo "OSRM dataset 검증: $profile"
  docker run --rm \
    --network none \
    --read-only \
    --volume "$RUNTIME_DIR/data/$profile:/data:ro" \
    "$IMAGE" \
    osrm-routed --trial --algorithm mld /data/map.osrm
done

docker compose --file "$COMPOSE_FILE" up -d

check_route() {
  local port=$1
  curl --fail --silent --show-error \
    "http://127.0.0.1:${port}/route/v1/driving/${START_LON},${START_LAT};${END_LON},${END_LAT}?overview=false" \
    | grep -q '"code":"Ok"'
}

for port in 5000 5001 5002; do
  ready=false
  for _ in $(seq 1 30); do
    if check_route "$port"; then
      ready=true
      break
    fi
    sleep 2
  done
  if [[ "$ready" != true ]]; then
    echo "OSRM 경로 응답 확인 실패: 127.0.0.1:$port" >&2
    docker compose --file "$COMPOSE_FILE" logs --tail 100 >&2
    exit 1
  fi
  echo "OSRM 경로 응답 정상: 127.0.0.1:$port"
done

docker compose --file "$COMPOSE_FILE" ps
