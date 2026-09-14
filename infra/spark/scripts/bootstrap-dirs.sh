#!/usr/bin/env bash
set -euo pipefail

if (( EUID != 0 )); then
  echo "root 권한으로 실행하세요: sudo $0" >&2
  exit 1
fi

readonly SPARK_UID=185
readonly SPARK_GID=185
readonly SPARK_DATA_ROOT=/srv/tashu/data/spark

for directory in events checkpoints output work; do
  install -d -o "$SPARK_UID" -g "$SPARK_GID" -m 0755 "$SPARK_DATA_ROOT/$directory"
done

find "$SPARK_DATA_ROOT" -maxdepth 1 -type d -printf '%M %u:%g %p\n' | sort
