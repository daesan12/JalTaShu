#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
fi

readonly action="${1:-}"
readonly image_sha="${2:-}"
readonly region="ap-northeast-2"
readonly state_dir="/var/lib/tashu-production"
readonly credential_file="/etc/tashu/ecr-pull/credentials"
readonly pull_script="/opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh"
readonly runtime_dir="/opt/tashu/infra/runtime/production"
readonly render_env_script="${runtime_dir}/scripts/render-backend-env.sh"
readonly deploy_slot_script="${runtime_dir}/scripts/deploy-slot.sh"
readonly nginx_site_source="/opt/tashu/infra/nginx/tashu.conf"
readonly nginx_site_target="/etc/nginx/sites-available/tashu.conf"
readonly frontend_upstream="/etc/nginx/tashu-production-frontend-upstream.conf"
readonly backend_upstream="/etc/nginx/tashu-production-backend-upstream.conf"
readonly lock_file="/run/lock/tashu-production-deploy.lock"

write_state() {
  local name="$1"
  local value="$2"
  local temporary
  temporary="$(mktemp "${state_dir}/.${name}.XXXXXX")"
  printf '%s\n' "${value}" > "${temporary}"
  chmod 0644 "${temporary}"
  mv -f "${temporary}" "${state_dir}/${name}"
}

read_state() {
  local name="$1"
  if [[ -s ${state_dir}/${name} ]]; then
    tr -d '\r\n' < "${state_dir}/${name}"
  fi
}

slot_ports() {
  case "$1" in
    blue)
      frontend_port=28080
      backend_port=28081
      ;;
    green)
      frontend_port=28082
      backend_port=28083
      ;;
    *)
      echo "올바르지 않은 slot 상태입니다: $1" >&2
      return 1
      ;;
  esac
}

wait_for_slot_health() {
  local slot="$1"
  local attempt frontend_health backend_health
  slot_ports "${slot}"

  for attempt in $(seq 1 45); do
    frontend_health="$(docker inspect --format '{{.State.Health.Status}}' "tashu-frontend-${slot}" 2>/dev/null || true)"
    backend_health="$(docker inspect --format '{{.State.Health.Status}}' "tashu-backend-${slot}" 2>/dev/null || true)"
    if [[ ${frontend_health} == healthy && ${backend_health} == healthy ]] &&
       curl --fail --silent "http://127.0.0.1:${frontend_port}/health" | grep -qx ok &&
       curl --fail --silent "http://127.0.0.1:${backend_port}/api/actuator/health" | grep -q '"status":"UP"'; then
      return 0
    fi
    if [[ ${frontend_health} == unhealthy || ${backend_health} == unhealthy ]]; then
      return 1
    fi
    sleep 4
  done
  return 1
}

install_production_route() {
  local slot="$1"
  local temporary_frontend temporary_backend
  local site_backup frontend_backup backend_backup
  local frontend_existed=false backend_existed=false
  slot_ports "${slot}"

  site_backup="$(mktemp "${state_dir}/.nginx-site.XXXXXX")"
  frontend_backup="$(mktemp "${state_dir}/.nginx-frontend-upstream.XXXXXX")"
  backend_backup="$(mktemp "${state_dir}/.nginx-backend-upstream.XXXXXX")"
  cp -a "${nginx_site_target}" "${site_backup}"
  if [[ -e ${frontend_upstream} ]]; then
    cp -a "${frontend_upstream}" "${frontend_backup}"
    frontend_existed=true
  fi
  if [[ -e ${backend_upstream} ]]; then
    cp -a "${backend_upstream}" "${backend_backup}"
    backend_existed=true
  fi
  if [[ ! -e ${state_dir}/legacy-nginx-site ]]; then
    cp -a "${nginx_site_target}" "${state_dir}/legacy-nginx-site"
    chmod 0600 "${state_dir}/legacy-nginx-site"
  fi

  temporary_frontend="$(mktemp /etc/nginx/.tashu-frontend-upstream.XXXXXX)"
  temporary_backend="$(mktemp /etc/nginx/.tashu-backend-upstream.XXXXXX)"
  printf 'server 127.0.0.1:%s;\n' "${frontend_port}" > "${temporary_frontend}"
  printf 'server 127.0.0.1:%s;\n' "${backend_port}" > "${temporary_backend}"
  chmod 0644 "${temporary_frontend}" "${temporary_backend}"

  mv -f "${temporary_frontend}" "${frontend_upstream}"
  mv -f "${temporary_backend}" "${backend_upstream}"
  install -o root -g root -m 0644 "${nginx_site_source}" "${nginx_site_target}"

  if nginx -t && systemctl reload nginx; then
    rm -f "${site_backup}" "${frontend_backup}" "${backend_backup}"
    return 0
  fi

  echo 'Nginx 전환에 실패해 직전 설정을 복구합니다.' >&2
  install -o root -g root -m 0644 "${site_backup}" "${nginx_site_target}"
  if [[ ${frontend_existed} == true ]]; then
    install -o root -g root -m 0644 "${frontend_backup}" "${frontend_upstream}"
  else
    rm -f "${frontend_upstream}"
  fi
  if [[ ${backend_existed} == true ]]; then
    install -o root -g root -m 0644 "${backend_backup}" "${backend_upstream}"
  else
    rm -f "${backend_upstream}"
  fi
  rm -f "${site_backup}" "${frontend_backup}" "${backend_backup}"
  nginx -t
  systemctl reload nginx
  return 1
}

prepare_candidate() {
  local account_id tag active_slot candidate_slot frontend_image backend_image
  if [[ ! ${image_sha} =~ ^[0-9a-f]{12}$ ]]; then
    echo 'prepare 사용법: jenkins-production-deploy.sh prepare <12자리 Git SHA>' >&2
    exit 1
  fi

  for required_file in "${credential_file}" "${pull_script}" "${render_env_script}" "${deploy_slot_script}"; do
    if [[ ! -e ${required_file} ]]; then
      echo "필수 production 배포 파일이 없습니다: ${required_file}" >&2
      exit 1
    fi
  done

  "${render_env_script}"
  active_slot="$(read_state active-slot)"
  case "${active_slot}" in
    blue) candidate_slot=green ;;
    green|'') candidate_slot=blue ;;
    *) echo "올바르지 않은 active slot입니다: ${active_slot}" >&2; exit 1 ;;
  esac

  export AWS_SHARED_CREDENTIALS_FILE="${credential_file}"
  export AWS_EC2_METADATA_DISABLED=true
  export AWS_PAGER=''
  account_id="$(aws sts get-caller-identity --query Account --output text)"
  tag="prod-${image_sha}"
  frontend_image="${account_id}.dkr.ecr.${region}.amazonaws.com/tashu/frontend:${tag}"
  backend_image="${account_id}.dkr.ecr.${region}.amazonaws.com/tashu/backend:${tag}"

  write_state candidate-slot "${candidate_slot}"
  write_state candidate-sha "${image_sha}"
  echo "비활성 ${candidate_slot} slot에 production ${image_sha} 배포를 시작합니다."
  "${pull_script}" tashu/frontend "${tag}"
  "${pull_script}" tashu/backend "${tag}"
  "${deploy_slot_script}" "${candidate_slot}" "${frontend_image}" "${backend_image}"

  if ! wait_for_slot_health "${candidate_slot}"; then
    echo "Production ${candidate_slot} candidate health check 실패" >&2
    exit 1
  fi

  echo "PRODUCTION_CANDIDATE_READY slot=${candidate_slot} sha=${image_sha}"
}

activate_candidate() {
  local candidate_slot candidate_sha active_slot active_sha
  if [[ ! ${image_sha} =~ ^[0-9a-f]{12}$ ]]; then
    echo 'activate 사용법: jenkins-production-deploy.sh activate <12자리 Git SHA>' >&2
    exit 1
  fi

  candidate_slot="$(read_state candidate-slot)"
  candidate_sha="$(read_state candidate-sha)"
  if [[ ${candidate_sha} != "${image_sha}" || ! ${candidate_slot} =~ ^(blue|green)$ ]]; then
    echo '승인 대상과 준비된 candidate가 일치하지 않습니다.' >&2
    exit 1
  fi
  if ! wait_for_slot_health "${candidate_slot}"; then
    echo '승인 전에 candidate health check가 실패했습니다.' >&2
    exit 1
  fi

  active_slot="$(read_state active-slot)"
  active_sha="$(read_state active-sha)"
  if [[ ${active_slot} =~ ^(blue|green)$ && ${active_sha} =~ ^[0-9a-f]{12}$ ]]; then
    write_state previous-slot "${active_slot}"
    write_state previous-sha "${active_sha}"
  else
    rm -f "${state_dir}/previous-slot" "${state_dir}/previous-sha"
  fi

  install_production_route "${candidate_slot}"
  write_state active-slot "${candidate_slot}"
  write_state active-sha "${candidate_sha}"
  rm -f "${state_dir}/candidate-slot" "${state_dir}/candidate-sha"
  echo "PRODUCTION_TRAFFIC_SWITCHED slot=${candidate_slot} sha=${candidate_sha}"
}

cleanup_candidate() {
  local candidate_slot candidate_sha active_slot container_name
  if [[ ! ${image_sha} =~ ^[0-9a-f]{12}$ ]]; then
    echo 'cleanup 사용법: jenkins-production-deploy.sh cleanup <12자리 Git SHA>' >&2
    exit 1
  fi

  candidate_slot="$(read_state candidate-slot)"
  candidate_sha="$(read_state candidate-sha)"
  if [[ -z ${candidate_slot} && -z ${candidate_sha} ]]; then
    echo "정리할 production candidate가 없습니다: sha=${image_sha}"
    return 0
  fi
  if [[ ! ${candidate_slot} =~ ^(blue|green)$ ]]; then
    echo '저장된 candidate slot이 올바르지 않아 자동 정리를 중단합니다.' >&2
    exit 1
  fi
  if [[ ${candidate_sha} != "${image_sha}" ]]; then
    echo "정리 요청 SHA와 candidate SHA가 달라 자동 정리를 중단합니다: requested=${image_sha}" >&2
    exit 1
  fi

  active_slot="$(read_state active-slot)"
  if [[ ${candidate_slot} == "${active_slot}" ]]; then
    echo 'candidate가 현재 활성 slot이므로 자동 정리를 거부합니다.' >&2
    exit 1
  fi

  for container_name in "tashu-frontend-${candidate_slot}" "tashu-backend-${candidate_slot}"; do
    if docker container inspect "${container_name}" >/dev/null 2>&1; then
      docker rm --force "${container_name}" >/dev/null
    fi
  done
  rm -f "${state_dir}/candidate-slot" "${state_dir}/candidate-sha"
  echo "PRODUCTION_CANDIDATE_CLEANED slot=${candidate_slot} sha=${candidate_sha}"
}

rollback_production() {
  local active_slot active_sha previous_slot previous_sha
  active_slot="$(read_state active-slot)"
  active_sha="$(read_state active-sha)"
  previous_slot="$(read_state previous-slot)"
  previous_sha="$(read_state previous-sha)"

  if [[ ${previous_slot} =~ ^(blue|green)$ && ${previous_sha} =~ ^[0-9a-f]{12}$ ]]; then
    wait_for_slot_health "${previous_slot}"
    install_production_route "${previous_slot}"
    write_state active-slot "${previous_slot}"
    write_state active-sha "${previous_sha}"
    if [[ ${active_slot} =~ ^(blue|green)$ && ${active_sha} =~ ^[0-9a-f]{12}$ ]]; then
      write_state previous-slot "${active_slot}"
      write_state previous-sha "${active_sha}"
    fi
    echo "PRODUCTION_ROLLED_BACK slot=${previous_slot} sha=${previous_sha}"
    return 0
  fi

  if [[ -s ${state_dir}/legacy-nginx-site ]]; then
    install -o root -g root -m 0644 "${state_dir}/legacy-nginx-site" "${nginx_site_target}"
    nginx -t
    systemctl reload nginx
    rm -f "${state_dir}/active-slot" "${state_dir}/active-sha"
    echo 'PRODUCTION_ROLLED_BACK legacy-nginx'
    return 0
  fi

  echo '롤백할 이전 production 상태가 없습니다.' >&2
  exit 1
}

install -d -o root -g root -m 0755 "${state_dir}"
exec 9>"${lock_file}"
if ! flock --nonblock 9; then
  echo '다른 production 배포가 진행 중입니다.' >&2
  exit 1
fi

case "${action}" in
  prepare) prepare_candidate ;;
  activate) activate_candidate ;;
  cleanup) cleanup_candidate ;;
  rollback)
    if [[ -n ${image_sha} ]]; then
      echo 'rollback에는 SHA 인자를 사용하지 않습니다.' >&2
      exit 1
    fi
    rollback_production
    ;;
  *)
    echo '사용법: jenkins-production-deploy.sh <prepare SHA|activate SHA|cleanup SHA|rollback>' >&2
    exit 1
    ;;
esac
