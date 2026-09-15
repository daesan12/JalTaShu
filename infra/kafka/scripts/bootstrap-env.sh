#!/usr/bin/env bash
set -euo pipefail

readonly ENV_DIR="/etc/tashu"
readonly ENV_FILE="${ENV_DIR}/kafka.env"
readonly KAFKA_IMAGE="apache/kafka:4.3.1"

if [[ "${EUID}" -ne 0 ]]; then
  printf 'root 권한으로 실행하세요: sudo %s\n' "$0" >&2
  exit 1
fi

if [[ -e "${ENV_FILE}" ]]; then
  printf '기존 파일을 덮어쓰지 않았습니다: %s\n' "${ENV_FILE}" >&2
  exit 1
fi

command -v docker >/dev/null

private_ip="$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i <= NF; i++) if ($i == "src") {print $(i + 1); exit}}')"
if [[ -z "${private_ip}" ]]; then
  printf 'Server B 사설 IPv4를 찾지 못했습니다.\n' >&2
  exit 1
fi

docker pull "${KAFKA_IMAGE}" >/dev/null
cluster_id="$(docker run --rm --entrypoint /opt/kafka/bin/kafka-storage.sh "${KAFKA_IMAGE}" random-uuid)"

install -d -o root -g root -m 0750 "${ENV_DIR}"
env_tmp="$(mktemp "${ENV_DIR}/kafka.env.XXXXXX")"
trap 'rm -f "${env_tmp}"' EXIT

cat >"${env_tmp}" <<EOF
KAFKA_BIND_HOST=${private_ip}
KAFKA_ADVERTISED_HOST=${private_ip}
KAFKA_CLUSTER_ID=${cluster_id}
EOF

chown root:root "${env_tmp}"
chmod 0640 "${env_tmp}"
mv "${env_tmp}" "${ENV_FILE}"
trap - EXIT

printf 'Kafka 서버 전용 환경파일 생성 완료: %s\n' "${ENV_FILE}"
stat -c '%A %U:%G %n' "${ENV_FILE}"
printf '값은 출력하지 않았습니다.\n'
