#!/usr/bin/env bash
set -euo pipefail

readonly SPARK_HOME_DIR=${SPARK_HOME_DIR:-/opt/tashu/spark}
readonly COMPOSE_FILE="$SPARK_HOME_DIR/compose.yml"

docker compose -f "$COMPOSE_FILE" ps
docker compose --profile tools -f "$COMPOSE_FILE" run --rm spark-submit \
  /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --conf spark.cores.max=2 \
  --conf spark.executor.cores=1 \
  --conf spark.executor.memory=1g \
  /opt/spark/examples/src/main/python/pi.py 20
