#!/usr/bin/env bash
set -euo pipefail

readonly BENCHMARK_DIR=${BENCHMARK_DIR:-/opt/tashu/spark/benchmark}
readonly COMPOSE_FILE="$BENCHMARK_DIR/compose.controller.yml"
readonly RESULT_HOST_DIR=/srv/tashu/data/spark-benchmark/results/failure-recovery
readonly RESULT_CONTAINER_DIR=/srv/tashu/spark-benchmark/results/failure-recovery
readonly ROWS=${TASHU_BENCHMARK_ROWS:-100000000}
readonly PARTITIONS=${TASHU_BENCHMARK_PARTITIONS:-96}
readonly OUTAGE_SECONDS=${TASHU_WORKER_OUTAGE_SECONDS:-15}

if [[ -z ${SPARK_MASTER_HOST:-} ]]; then
  echo "SPARK_MASTER_HOST에 Server B 사설 IP를 설정하세요." >&2
  exit 1
fi

readonly ACTUAL_WORKERS=$(curl -fsS http://127.0.0.1:18181/json/ | python3 -c \
  'import json,sys; print(sum(1 for worker in json.load(sys.stdin)["workers"] if worker["state"] == "ALIVE"))')
if [[ "$ACTUAL_WORKERS" != 2 ]]; then
  echo "장애 시험 시작 전 Worker가 2개여야 합니다: actual=$ACTUAL_WORKERS" >&2
  exit 1
fi

install -d -o 185 -g 185 -m 0755 "$RESULT_HOST_DIR"
readonly RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
readonly WORKLOAD_HOST_RESULT="$RESULT_HOST_DIR/workload-$RUN_ID.json"
readonly WORKLOAD_CONTAINER_RESULT="$RESULT_CONTAINER_DIR/workload-$RUN_ID.json"
readonly DRIVER_LOG="$RESULT_HOST_DIR/driver-$RUN_ID.log"
readonly TEST_RESULT="$RESULT_HOST_DIR/failure-recovery-$RUN_ID.json"

restore_worker() {
  docker start tashu-spark-benchmark-worker-b >/dev/null 2>&1 || true
}
trap restore_worker EXIT

echo "1억 행 작업을 두 Worker에서 시작합니다."
SPARK_MASTER_HOST="$SPARK_MASTER_HOST" docker compose \
  --profile tools \
  --file "$COMPOSE_FILE" \
  run --rm --no-deps benchmark-submit \
  /opt/spark/bin/spark-submit \
  --master "spark://$SPARK_MASTER_HOST:17077" \
  --deploy-mode client \
  --conf "spark.driver.host=$SPARK_MASTER_HOST" \
  --conf spark.driver.bindAddress=0.0.0.0 \
  --conf spark.driver.port=17080 \
  --conf spark.driver.blockManager.port=17081 \
  --conf spark.blockManager.port=17082 \
  --conf spark.cores.max=4 \
  --conf spark.executor.cores=2 \
  --conf spark.executor.memory=2g \
  --conf spark.local.dir=/srv/tashu/spark-benchmark/work \
  /opt/tashu/spark-benchmark/workload.py \
  --label two-workers \
  --rows "$ROWS" \
  --partitions "$PARTITIONS" \
  --output "$WORKLOAD_CONTAINER_RESULT" >"$DRIVER_LOG" 2>&1 &
readonly JOB_PID=$!

REGISTERED_EXECUTORS=0
for _ in $(seq 1 40); do
  if ! kill -0 "$JOB_PID" 2>/dev/null; then
    echo "장애를 주입하기 전에 Spark 작업이 종료됐습니다." >&2
    wait "$JOB_PID"
    exit 1
  fi
  REGISTERED_EXECUTORS=$(grep -Ec 'Registered executor .* with ID' "$DRIVER_LOG" 2>/dev/null || true)
  [[ "$REGISTERED_EXECUTORS" -ge 2 ]] && break
  sleep 1
done
if [[ "$REGISTERED_EXECUTORS" -lt 2 ]]; then
  echo "40초 안에 executor 2개가 등록되지 않았습니다." >&2
  exit 1
fi
sleep 2

readonly FAILURE_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "시험용 Worker B를 중단합니다: $FAILURE_AT"
docker stop -t 1 tashu-spark-benchmark-worker-b >/dev/null

sleep "$OUTAGE_SECONDS"
readonly RECOVERY_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "시험용 Worker B를 다시 시작합니다: $RECOVERY_AT"
docker start tashu-spark-benchmark-worker-b >/dev/null

for _ in $(seq 1 30); do
  ALIVE_WORKERS=$(curl -fsS http://127.0.0.1:18181/json/ 2>/dev/null | python3 -c \
    'import json,sys; print(sum(1 for worker in json.load(sys.stdin)["workers"] if worker["state"] == "ALIVE"))' 2>/dev/null || echo 0)
  [[ "$ALIVE_WORKERS" == 2 ]] && break
  sleep 1
done

set +e
wait "$JOB_PID"
readonly JOB_STATUS=$?
set -e

test "$JOB_STATUS" -eq 0
test -s "$WORKLOAD_HOST_RESULT"

readonly LOSS_LOG_LINES=$(grep -Eic 'ExecutorLostFailure|Lost executor|executor.*lost|worker.*removed|Connection reset' "$DRIVER_LOG" || true)
python3 - "$WORKLOAD_HOST_RESULT" "$TEST_RESULT" "$FAILURE_AT" "$RECOVERY_AT" "$OUTAGE_SECONDS" "$LOSS_LOG_LINES" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

workload_path, result_path, failure_at, recovery_at, outage_seconds, loss_lines = sys.argv[1:]
workload = json.loads(Path(workload_path).read_text(encoding="utf-8"))
result = {
    "benchmark": "spark-worker-failure-recovery",
    "finished_at": datetime.now(timezone.utc).isoformat(),
    "worker_failure_at": failure_at,
    "worker_recovery_at": recovery_at,
    "configured_outage_seconds": int(outage_seconds),
    "driver_loss_log_lines": int(loss_lines),
    "job_completed": True,
    "workload": workload,
}
Path(result_path).write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2, sort_keys=True))
PY

trap - EXIT
restore_worker
