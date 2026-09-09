#!/usr/bin/env bash
set -euo pipefail

readonly group_name="tashu-jenkins"
readonly secret_dir="${JENKINS_SECRET_DIR:-/etc/tashu/jenkins}"
readonly runtime_env="${secret_dir}/runtime.env"
readonly password_file="${secret_dir}/admin-password"
readonly agent_private_key="${secret_dir}/agent-ed25519"
readonly agent_public_key="${agent_private_key}.pub"
readonly agent_host_key_dir="/srv/tashu/data/jenkins-agent-ssh"
readonly agent_host_private_key="${agent_host_key_dir}/ssh_host_ed25519_key"
readonly agent_host_public_key="${agent_host_private_key}.pub"
readonly controller_host_key_file="${secret_dir}/agent-host-key"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 권한으로 실행해야 합니다." >&2
  exit 1
fi

if ! getent group "${group_name}" >/dev/null; then
  groupadd --system "${group_name}"
fi

readonly secret_gid="$(getent group "${group_name}" | cut -d: -f3)"

install -d -o root -g "${group_name}" -m 0750 "${secret_dir}"
install -d -o root -g root -m 0700 "${agent_host_key_dir}"

if [[ ! -e "${password_file}" ]]; then
  umask 027
  openssl rand -hex 24 | tr -d '\n' > "${password_file}"
  echo "생성: ${password_file}"
else
  echo "유지: ${password_file}"
fi

chown root:"${group_name}" "${password_file}"
chmod 0640 "${password_file}"

if [[ ! -e "${agent_private_key}" ]]; then
  ssh-keygen -q -t ed25519 -N '' -C 'tashu-jenkins-build-agent' -f "${agent_private_key}"
  echo "생성: Jenkins Build Agent 접속용 SSH key pair"
else
  echo "유지: Jenkins Build Agent 접속용 SSH key pair"
fi

chown root:"${group_name}" "${agent_private_key}"
chmod 0640 "${agent_private_key}"
chown root:root "${agent_public_key}"
chmod 0644 "${agent_public_key}"

if [[ ! -e "${agent_host_private_key}" ]]; then
  ssh-keygen -q -t ed25519 -N '' -C 'tashu-jenkins-agent-host' -f "${agent_host_private_key}"
  echo "생성: Jenkins Build Agent 고정 host key pair"
else
  echo "유지: Jenkins Build Agent 고정 host key pair"
fi

chown root:root "${agent_host_private_key}" "${agent_host_public_key}"
chmod 0600 "${agent_host_private_key}"
chmod 0644 "${agent_host_public_key}"

awk '{print $1 " " $2}' "${agent_host_public_key}" > "${controller_host_key_file}"
chown root:"${group_name}" "${controller_host_key_file}"
chmod 0640 "${controller_host_key_file}"

if [[ ! -S /var/run/docker.sock ]]; then
  echo "/var/run/docker.sock을 찾을 수 없습니다." >&2
  exit 1
fi

readonly docker_gid="$(stat -c '%g' /var/run/docker.sock)"
readonly agent_ssh_public_key="$(cat "${agent_public_key}")"

{
  printf 'JENKINS_SECRET_DIR=%s\n' "${secret_dir}"
  printf 'JENKINS_SECRET_GID=%s\n' "${secret_gid}"
  printf 'DOCKER_GID=%s\n' "${docker_gid}"
  printf 'JENKINS_AGENT_SSH_PUBKEY="%s"\n' "${agent_ssh_public_key}"
} > "${runtime_env}"

chown root:root "${runtime_env}"
chmod 0640 "${runtime_env}"

echo "runtime 환경파일 생성: ${runtime_env}"
echo "관리자 비밀번호와 private key 값은 출력하지 않았습니다."
