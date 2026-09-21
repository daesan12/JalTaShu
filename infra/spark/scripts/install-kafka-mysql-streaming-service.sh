#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  echo "root 권한으로 실행하세요: sudo $0 <병합된 kafka_mysql_streaming.py 경로>" >&2
  exit 1
fi

if (( $# != 1 )); then
  echo "사용법: sudo $0 <병합된 kafka_mysql_streaming.py 경로>" >&2
  exit 1
fi

readonly SOURCE_JOB=$(readlink -f -- "$1")
readonly TARGET_DIR=/srv/tashu/workspace/data/jobs
readonly TARGET_JOB=$TARGET_DIR/kafka_mysql_streaming.py
readonly CLEANUP_SCRIPT=/opt/tashu/spark/scripts/cleanup-kafka-mysql-streaming-container.sh
readonly SOURCE_UNIT=/opt/tashu/spark/systemd/tashu-kafka-mysql-streaming.service
readonly TARGET_UNIT=/etc/systemd/system/tashu-kafka-mysql-streaming.service

test -f "$SOURCE_JOB"
test -f "$SOURCE_UNIT"
test -x /opt/tashu/spark/scripts/submit-data-job.sh
test -x "$CLEANUP_SCRIPT"
test -r /etc/tashu/streaming/mysql-data-writer.env
id tashu-data >/dev/null
getent group tashu-spark >/dev/null

install -d -o tashu-data -g tashu-spark -m 2770 "$TARGET_DIR"
install -o tashu-data -g tashu-spark -m 0640 "$SOURCE_JOB" "$TARGET_JOB"
install -o root -g root -m 0644 "$SOURCE_UNIT" "$TARGET_UNIT"

systemd-analyze verify "$TARGET_UNIT"
systemctl daemon-reload
systemctl enable --now tashu-kafka-mysql-streaming.service

systemctl --no-pager --full status tashu-kafka-mysql-streaming.service
stat -c '%A %U:%G %n' "$TARGET_JOB" "$TARGET_UNIT"
