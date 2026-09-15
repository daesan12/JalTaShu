#!/usr/bin/env bash
set -euo pipefail

readonly BENCHMARK_DIR=${BENCHMARK_DIR:-/opt/tashu/spark/benchmark}
readonly COMPOSE_FILE="$BENCHMARK_DIR/compose.controller.yml"
readonly RESULT_HOST_DIR=/srv/tashu/data/spark-benchmark/results
readonly RESULT_CONTAINER_DIR=/srv/tashu/spark-benchmark/results
readonly ROWS=${TASHU_BENCHMARK_ROWS:-50000000}
readonly PARTITIONS=${TASHU_BENCHMARK_PARTITIONS:-96}

if [[ -z ${SPARK_MASTER_HOST:-} ]]; then
  echo "SPARK_MASTER_HOST에 Server B 사설 IP를 설정하세요." >&2
  exit 1
fi

if (( $# != 1 )); then
  echo "사용법: sudo -E $0 <local|one-worker|two-workers>" >&2
  exit 1
fi

readonly CASE_NAME=$1
case "$CASE_NAME" in
  local)
    MASTER_URL='local[2]'
    EXPECTED_WORKERS=0
    MAX_CORES=2
    ;;
  one-worker)
    MASTER_URL="spark://$SPARK_MASTER_HOST:17077"
    EXPECTED_WORKERS=1
    MAX_CORES=2
    ;;
  two-workers)
    MASTER_URL="spark://$SPARK_MASTER_HOST:17077"
    EXPECTED_WORKERS=2
    MAX_CORES=4
    ;;
  *)
    echo "지원하지 않는 비교 조건입니다: $CASE_NAME" >&2
    exit 1
    ;;
esac

if [[ "$CASE_NAME" != local ]]; then
  readonly ACTUAL_WORKERS=$(curl -fsS http://127.0.0.1:18181/json/ | python3 -c \
    'import json,sys; print(sum(1 for worker in json.load(sys.stdin)["workers"] if worker["state"] == "ALIVE"))')
  if [[ "$ACTUAL_WORKERS" != "$EXPECTED_WORKERS" ]]; then
    echo "Worker 수가 예상과 다릅니다: expected=$EXPECTED_WORKERS actual=$ACTUAL_WORKERS" >&2
    exit 1
  fi
fi

install -d -o 185 -g 185 -m 0755 "$RESULT_HOST_DIR"
readonly RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
readonly OUTPUT_HOST_FILE="$RESULT_HOST_DIR/${CASE_NAME}-${RUN_ID}.json"
readonly OUTPUT_CONTAINER_FILE="$RESULT_CONTAINER_DIR/${CASE_NAME}-${RUN_ID}.json"

SPARK_MASTER_HOST="$SPARK_MASTER_HOST" docker compose \
  --profile tools \
  --file "$COMPOSE_FILE" \
  run --rm --no-deps benchmark-submit \
  /opt/spark/bin/spark-submit \
  --master "$MASTER_URL" \
  --deploy-mode client \
  --conf "spark.driver.host=$SPARK_MASTER_HOST" \
  --conf spark.driver.bindAddress=0.0.0.0 \
  --conf spark.driver.port=17080 \
  --conf spark.driver.blockManager.port=17081 \
  --conf spark.blockManager.port=17082 \
  --conf "spark.cores.max=$MAX_CORES" \
  --conf spark.executor.cores=2 \
  --conf spark.executor.memory=2g \
  --conf spark.local.dir=/srv/tashu/spark-benchmark/work \
  /opt/tashu/spark-benchmark/workload.py \
  --label "$CASE_NAME" \
  --rows "$ROWS" \
  --partitions "$PARTITIONS" \
  --output "$OUTPUT_CONTAINER_FILE"

test -s "$OUTPUT_HOST_FILE"
cat "$OUTPUT_HOST_FILE"
