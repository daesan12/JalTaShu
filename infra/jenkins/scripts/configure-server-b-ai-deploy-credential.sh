#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo '사용법: configure-server-b-ai-deploy-credential.sh <Server B 사설 IPv4>' >&2
  exit 1
fi

readonly server_b_host="$1"
readonly group_name="tashu-jenkins"
readonly secret_dir="${JENKINS_SECRET_DIR:-/etc/tashu/jenkins}"
readonly deploy_host_file="${secret_dir}/server-b-deploy-host"
readonly known_hosts_file="${secret_dir}/server-b-deploy-known-hosts"
readonly deploy_private_key="${secret_dir}/server-b-ai-deploy-ed25519"
readonly deploy_public_key="${deploy_private_key}.pub"
readonly ssh_host_public_key="/etc/ssh/ssh_host_ed25519_key.pub"

if [[ ! ${server_b_host} =~ ^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\. ]]; then
  echo 'Server B host는 사설 IPv4 주소여야 합니다.' >&2
  exit 1
fi

for required_file in "${deploy_private_key}" "${deploy_public_key}" "${ssh_host_public_key}"; do
  if [[ ! -s ${required_file} ]]; then
    echo "필수 파일이 없습니다: ${required_file}" >&2
    exit 1
  fi
done

if ! getent group "${group_name}" >/dev/null; then
  echo "${group_name} 그룹이 없습니다. generate-secrets.sh를 먼저 실행하세요." >&2
  exit 1
fi

read -r host_key_type host_key_value _ < "${ssh_host_public_key}"
if [[ ${host_key_type:-} != ssh-ed25519 || -z ${host_key_value:-} ]]; then
  echo 'Server B Ed25519 SSH host key를 읽지 못했습니다.' >&2
  exit 1
fi

install -d -o root -g "${group_name}" -m 0750 "${secret_dir}"
printf '%s' "${server_b_host}" > "${deploy_host_file}"
printf '%s %s %s\n' "${server_b_host}" "${host_key_type}" "${host_key_value}" > "${known_hosts_file}"

chown root:"${group_name}" "${deploy_host_file}"
chmod 0640 "${deploy_host_file}"
chown root:root "${known_hosts_file}"
chmod 0644 "${known_hosts_file}"

echo "Server B AI 배포용 Jenkins 파일 준비 완료: ${server_b_host}"
echo "공개키 파일: ${deploy_public_key}"
echo 'Private key와 Secret 값은 출력하지 않았습니다.'
