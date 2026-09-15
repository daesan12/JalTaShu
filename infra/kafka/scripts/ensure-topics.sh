#!/usr/bin/env bash
set -Eeuo pipefail

readonly env_file="${1:-/etc/tashu/kafka.env}"
readonly topic='tashu.station-availability.v1'
readonly partitions='3'
readonly replication_factor='1'
readonly retention_ms='259200000'

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 권한으로 실행하세요: sudo $0" >&2
  exit 1
fi

if [[ ! -r "${env_file}" ]]; then
  echo "Kafka 환경파일을 읽을 수 없습니다: ${env_file}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${env_file}"
set +a

readonly bootstrap_server="${KAFKA_ADVERTISED_HOST:?KAFKA_ADVERTISED_HOST is required}:9092"
readonly health="$(docker inspect --format '{{.State.Health.Status}}' tashu-kafka 2>/dev/null || true)"

if [[ "${health}" != 'healthy' ]]; then
  echo "Kafka 컨테이너가 healthy 상태가 아닙니다: ${health:-missing}" >&2
  exit 1
fi

docker exec tashu-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server "${bootstrap_server}" \
  --create \
  --if-not-exists \
  --topic "${topic}" \
  --partitions "${partitions}" \
  --replication-factor "${replication_factor}"

docker exec tashu-kafka /opt/kafka/bin/kafka-configs.sh \
  --bootstrap-server "${bootstrap_server}" \
  --entity-type topics \
  --entity-name "${topic}" \
  --alter \
  --add-config "cleanup.policy=delete,retention.ms=${retention_ms}"

description="$(docker exec tashu-kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server "${bootstrap_server}" \
  --describe \
  --topic "${topic}")"

grep -q "PartitionCount: ${partitions}" <<<"${description}"
grep -q "ReplicationFactor: ${replication_factor}" <<<"${description}"
grep -q "retention.ms=${retention_ms}" <<<"${description}"

printf '%s\n' "${description}"
echo "Kafka topic contract verified: topic=${topic} retention_hours=72"
