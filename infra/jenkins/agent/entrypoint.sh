#!/usr/bin/env bash
set -euo pipefail

readonly docker_socket="/var/run/docker.sock"
readonly expected_docker_gid="${DOCKER_GID:?DOCKER_GID is required}"

if [[ ! "${expected_docker_gid}" =~ ^[0-9]+$ ]]; then
  echo "DOCKER_GID must be numeric." >&2
  exit 1
fi

if [[ ! -S "${docker_socket}" ]]; then
  echo "Docker socket not found: ${docker_socket}" >&2
  exit 1
fi

readonly actual_docker_gid="$(stat -c '%g' "${docker_socket}")"
if [[ "${actual_docker_gid}" != "${expected_docker_gid}" ]]; then
  echo "Docker socket GID mismatch: expected=${expected_docker_gid}, actual=${actual_docker_gid}" >&2
  exit 1
fi

docker_group="$(getent group "${expected_docker_gid}" | cut -d: -f1 || true)"
if [[ -z "${docker_group}" ]]; then
  docker_group="docker-host"
  groupadd --gid "${expected_docker_gid}" "${docker_group}"
fi

usermod --append --groups "${docker_group}" jenkins

exec setup-sshd "$@"
