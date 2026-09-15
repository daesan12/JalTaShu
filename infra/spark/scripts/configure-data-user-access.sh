#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  echo "root 권한으로 실행하세요: sudo $0" >&2
  exit 1
fi

readonly DATA_USER=tashu-data
readonly DATA_GROUP=tashu-spark
readonly SUBMIT_COMMAND=/opt/tashu/spark/scripts/submit-data-job.sh
readonly SUDOERS_FILE=/etc/sudoers.d/tashu-data-spark-submit

id "$DATA_USER" >/dev/null
getent group "$DATA_GROUP" >/dev/null
test -x "$SUBMIT_COMMAND"

install -d -o "$DATA_USER" -g "$DATA_GROUP" -m 2770 /srv/tashu/workspace/data
chown root:root "$SUBMIT_COMMAND"
chmod 0755 "$SUBMIT_COMMAND"

readonly TEMP_FILE=$(mktemp)
trap 'rm -f "$TEMP_FILE"' EXIT

printf '%s ALL=(root) NOPASSWD: %s *\n' "$DATA_USER" "$SUBMIT_COMMAND" > "$TEMP_FILE"
chmod 0440 "$TEMP_FILE"
visudo -cf "$TEMP_FILE"
install -o root -g root -m 0440 "$TEMP_FILE" "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE"

printf '설정 완료: %s 계정은 %s 명령만 암호 없이 실행할 수 있습니다.\n' \
  "$DATA_USER" "$SUBMIT_COMMAND"
stat -c '%A %U:%G %n' "$SUDOERS_FILE" "$SUBMIT_COMMAND" /srv/tashu/workspace/data
