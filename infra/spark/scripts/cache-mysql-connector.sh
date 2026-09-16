#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  echo "root 권한으로 실행하세요: sudo $0" >&2
  exit 1
fi

readonly COMPOSE_FILE=/opt/tashu/spark/compose.yml
readonly SPARK_IVY_CACHE=/srv/tashu/data/spark/ivy
readonly MYSQL_CONNECTOR_PACKAGE=com.mysql:mysql-connector-j:9.6.0

install -d -o 185 -g 185 -m 0755 \
  "$SPARK_IVY_CACHE" \
  "$SPARK_IVY_CACHE/cache" \
  "$SPARK_IVY_CACHE/jars"

docker compose \
  --profile tools \
  --file "$COMPOSE_FILE" \
  run \
  --rm \
  --no-deps \
  --volume "$SPARK_IVY_CACHE:$SPARK_IVY_CACHE" \
  spark-submit \
  /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --deploy-mode client \
  --conf spark.jars.ivy="$SPARK_IVY_CACHE" \
  --packages "$MYSQL_CONNECTOR_PACKAGE" \
  --conf spark.cores.max=1 \
  /opt/spark/examples/src/main/python/pi.py 1

test -n "$(find "$SPARK_IVY_CACHE/jars" -maxdepth 1 -type f -name 'com.mysql_mysql-connector-j-9.6.0.jar' -print -quit)"
echo "MySQL Connector/J 9.6.0 cache ready"
