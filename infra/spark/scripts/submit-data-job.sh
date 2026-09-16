#!/usr/bin/env bash
set -euo pipefail

readonly SPARK_HOME_DIR=/opt/tashu/spark
readonly COMPOSE_FILE="$SPARK_HOME_DIR/compose.yml"
readonly DATA_WORKSPACE=/srv/tashu/workspace/data
readonly SPARK_IVY_CACHE=/srv/tashu/data/spark/ivy
readonly MYSQL_ENV_FILE=/etc/tashu/streaming/mysql-data-writer.env

if (( EUID != 0 )); then
  echo "이 명령은 제한된 sudo 권한으로 실행해야 합니다." >&2
  exit 1
fi

readonly CALLER=${SUDO_USER:-root}
if [[ "$CALLER" != root && "$CALLER" != tashu-data ]]; then
  echo "허용되지 않은 실행 계정입니다: $CALLER" >&2
  exit 1
fi

if (( $# < 1 )); then
  echo "사용법: sudo $0 <workspace 기준 Python 파일> [애플리케이션 인자...]" >&2
  exit 1
fi

readonly JOB_RELATIVE_PATH=$1
shift

if [[ "$JOB_RELATIVE_PATH" = /* || "$JOB_RELATIVE_PATH" != *.py ]]; then
  echo "작업 경로는 workspace 기준의 .py 파일이어야 합니다." >&2
  exit 1
fi

readonly WORKSPACE_REAL=$(readlink -f -- "$DATA_WORKSPACE")
readonly JOB_REAL=$(readlink -f -- "$DATA_WORKSPACE/$JOB_RELATIVE_PATH")

if [[ ! -f "$JOB_REAL" ]]; then
  echo "작업 파일을 찾을 수 없습니다: $JOB_RELATIVE_PATH" >&2
  exit 1
fi

case "$JOB_REAL" in
  "$WORKSPACE_REAL"/*.py) ;;
  *)
    echo "작업 폴더 밖의 파일은 실행할 수 없습니다." >&2
    exit 1
    ;;
esac

for container in tashu-spark-master tashu-spark-worker-b; do
  if [[ $(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || true) != healthy ]]; then
    echo "Spark 컨테이너가 healthy 상태가 아닙니다: $container" >&2
    exit 1
  fi
done

if [[ ! -r "$MYSQL_ENV_FILE" ]]; then
  echo "MySQL writer 환경파일을 읽을 수 없습니다: $MYSQL_ENV_FILE" >&2
  exit 1
fi

mapfile -d '' CONNECTOR_JARS < <(
  find "$SPARK_IVY_CACHE/jars" -maxdepth 1 -type f -name '*.jar' -print0 | sort -z
)
if (( ${#CONNECTOR_JARS[@]} == 0 )); then
  echo "Spark connector cache가 없습니다. 인프라 담당자가 connector cache script를 먼저 실행해야 합니다." >&2
  exit 1
fi

readonly CONNECTOR_JARS_CSV=$(IFS=,; printf '%s' "${CONNECTOR_JARS[*]}")

readonly JOB_CONTAINER_PATH="/workspace/data/${JOB_REAL#"$WORKSPACE_REAL"/}"

exec docker compose \
  --profile tools \
  --file "$COMPOSE_FILE" \
  run \
  --rm \
  --no-deps \
  --env-from-file "$MYSQL_ENV_FILE" \
  --volume "$WORKSPACE_REAL:/workspace/data:ro" \
  --volume "$SPARK_IVY_CACHE:$SPARK_IVY_CACHE:ro" \
  spark-submit \
  /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --jars "$CONNECTOR_JARS_CSV" \
  --conf spark.cores.max=2 \
  --conf spark.executor.cores=1 \
  --conf spark.executor.memory=1g \
  "$JOB_CONTAINER_PATH" \
  "$@"
