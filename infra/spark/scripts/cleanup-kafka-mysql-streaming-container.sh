#!/usr/bin/env bash
set -euo pipefail

readonly container_name=tashu-kafka-mysql-streaming

docker rm -f "$container_name" >/dev/null 2>&1 || true
for _ in $(seq 1 30); do
  if ! docker inspect "$container_name" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "기존 Streaming submit container 정리가 30초 안에 끝나지 않았습니다." >&2
exit 1
