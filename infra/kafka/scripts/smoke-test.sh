#!/usr/bin/env bash
set -euo pipefail

readonly ENV_FILE="${1:-/etc/tashu/kafka.env}"
readonly COMPOSE_FILE="${2:-/opt/tashu/kafka/compose.yml}"

if [[ "${EUID}" -ne 0 ]]; then
  printf 'root 권한으로 실행하세요: sudo %s\n' "$0" >&2
  exit 1
fi

if [[ ! -r "${ENV_FILE}" ]]; then
  printf '환경파일을 읽을 수 없습니다: %s\n' "${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

readonly BOOTSTRAP_SERVER="${KAFKA_ADVERTISED_HOST}:9092"
readonly TOPIC="tashu.smoke.$(date +%s)"
readonly MESSAGE="kafka-smoke-$(date -u +%Y%m%dT%H%M%SZ)"

cleanup() {
  docker exec tashu-kafka /opt/kafka/bin/kafka-topics.sh \
    --bootstrap-server "${BOOTSTRAP_SERVER}" \
    --delete \
    --topic "${TOPIC}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
docker exec tashu-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server "${BOOTSTRAP_SERVER}" \
  --create \
  --topic "${TOPIC}" \
  --partitions 1 \
  --replication-factor 1

printf '%s\n' "${MESSAGE}" | docker exec -i tashu-kafka \
  /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server "${BOOTSTRAP_SERVER}" \
  --topic "${TOPIC}" >/dev/null

received="$(docker exec tashu-kafka \
  /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server "${BOOTSTRAP_SERVER}" \
  --topic "${TOPIC}" \
  --from-beginning \
  --max-messages 1 \
  --timeout-ms 10000 2>/dev/null)"

if [[ "${received}" != "${MESSAGE}" ]]; then
  printf 'Kafka smoke test 메시지가 일치하지 않습니다.\n' >&2
  exit 1
fi

printf 'Kafka smoke test 성공: create → produce → consume → delete\n'
