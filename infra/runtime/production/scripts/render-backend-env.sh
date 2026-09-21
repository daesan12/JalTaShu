#!/usr/bin/env bash
set -euo pipefail

readonly secret_dir="${TASHU_BACKEND_PRODUCTION_SECRET_DIR:-/etc/tashu/backend-production}"
readonly oauth_source="${TASHU_BACKEND_OAUTH_SOURCE_ENV:-/etc/tashu/backend-staging/oauth.env}"
readonly jwt_source="${TASHU_BACKEND_JWT_SOURCE_ENV:-/etc/tashu/backend-staging/jwt.env}"
readonly mysql_password_file="${TASHU_MYSQL_PRODUCTION_PASSWORD_FILE:-/etc/tashu/mysql/prod-password}"
readonly redis_env="${TASHU_REDIS_ENV_FILE:-/etc/tashu/redis/runtime.env}"
readonly naver_place_env="${TASHU_NAVER_PLACE_ENV_FILE:-/etc/tashu/backend-common/naver-place.env}"
readonly admin_bootstrap_env="${TASHU_ADMIN_BOOTSTRAP_ENV_FILE:-/etc/tashu/backend-common/admin-bootstrap.env}"
readonly public_origin="${TASHU_PUBLIC_ORIGIN:-https://j15b103.p.ssafy.io}"
readonly runtime_env="${secret_dir}/runtime.env"

read_env_value() {
  local file_path="$1"
  local variable_name="$2"
  local line

  line="$(grep -m1 -E "^${variable_name}=" "${file_path}" || true)"
  if [[ -z ${line} || -z ${line#*=} ]]; then
    echo "필수 설정이 없습니다: ${variable_name} (${file_path})" >&2
    exit 1
  fi
  printf '%s' "${line#*=}"
}

for required_file in \
  "${oauth_source}" \
  "${jwt_source}" \
  "${mysql_password_file}" \
  "${redis_env}" \
  "${naver_place_env}" \
  "${admin_bootstrap_env}"; do
  if [[ ! -s ${required_file} ]]; then
    echo "필수 Secret 파일이 없거나 비어 있습니다: ${required_file}" >&2
    exit 1
  fi
done

if [[ ! ${public_origin} =~ ^https://[A-Za-z0-9.-]+$ ]]; then
  echo 'TASHU_PUBLIC_ORIGIN은 path가 없는 HTTPS origin이어야 합니다.' >&2
  exit 1
fi

install -d -o root -g root -m 0700 "${secret_dir}"

kakao_rest_api_key="$(read_env_value "${oauth_source}" KAKAO_REST_API_KEY)"
kakao_client_secret="$(read_env_value "${oauth_source}" KAKAO_CLIENT_SECRET)"
jwt_secret="$(read_env_value "${jwt_source}" JWT_SECRET_BASE64)"
jwt_access_expires="$(read_env_value "${jwt_source}" JWT_ACCESS_TOKEN_EXPIRES)"
jwt_refresh_expires="$(read_env_value "${jwt_source}" JWT_REFRESH_TOKEN_EXPIRES)"
redis_password="$(read_env_value "${redis_env}" REDIS_PASSWORD)"
naver_client_id="$(read_env_value "${naver_place_env}" NAVER_CLIENT_ID)"
naver_client_secret="$(read_env_value "${naver_place_env}" NAVER_CLIENT_SECRET)"
admin_bootstrap_enabled="$(read_env_value "${admin_bootstrap_env}" ADMIN_BOOTSTRAP_ENABLED)"
admin_bootstrap_id="$(read_env_value "${admin_bootstrap_env}" ADMIN_BOOTSTRAP_ID)"
admin_bootstrap_password="$(read_env_value "${admin_bootstrap_env}" ADMIN_BOOTSTRAP_PASSWORD)"
mysql_password="$(<"${mysql_password_file}")"

if [[ -z ${mysql_password} ]]; then
  echo 'MySQL production 비밀번호가 비어 있습니다.' >&2
  exit 1
fi

if [[ ${admin_bootstrap_enabled} != true && ${admin_bootstrap_enabled} != false ]]; then
  echo 'ADMIN_BOOTSTRAP_ENABLED는 true 또는 false여야 합니다.' >&2
  exit 1
fi
if [[ ${admin_bootstrap_enabled} == true && ${#admin_bootstrap_password} -lt 12 ]]; then
  echo 'production 관리자 초기 비밀번호는 12자 이상이어야 합니다.' >&2
  exit 1
fi

temporary_file="$(mktemp "${secret_dir}/.runtime.env.XXXXXX")"
trap 'rm -f "${temporary_file:-}"; unset kakao_rest_api_key kakao_client_secret jwt_secret jwt_access_expires jwt_refresh_expires redis_password naver_client_id naver_client_secret admin_bootstrap_enabled admin_bootstrap_id admin_bootstrap_password mysql_password' EXIT

{
  printf 'SPRING_DATASOURCE_URL=%s\n' 'jdbc:mysql://tashu-mysql:3306/tashu_prod?useSSL=false&useUnicode=true&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true'
  printf 'SPRING_DATASOURCE_USERNAME=%s\n' 'tashu_prod_user'
  printf 'SPRING_DATASOURCE_PASSWORD=%s\n' "${mysql_password}"
  printf 'SPRING_DATA_REDIS_HOST=%s\n' 'tashu-redis'
  printf 'SPRING_DATA_REDIS_PORT=%s\n' '6379'
  printf 'SPRING_DATA_REDIS_PASSWORD=%s\n' "${redis_password}"
  printf 'SPRING_DATA_REDIS_DATABASE=%s\n' '0'
  printf 'TASHU_STATION_REDIS_HOST=%s\n' 'tashu-redis'
  printf 'TASHU_STATION_REDIS_PORT=%s\n' '6379'
  printf 'TASHU_STATION_REDIS_PASSWORD=%s\n' "${redis_password}"
  printf 'TASHU_STATION_REDIS_DATABASE=%s\n' '0'
  printf 'TASHU_PREDICTION_REDIS_HOST=%s\n' 'tashu-redis'
  printf 'TASHU_PREDICTION_REDIS_PORT=%s\n' '6379'
  printf 'TASHU_PREDICTION_REDIS_PASSWORD=%s\n' "${redis_password}"
  printf 'TASHU_PREDICTION_REDIS_DATABASE=%s\n' '2'
  printf 'NAVER_CLIENT_ID=%s\n' "${naver_client_id}"
  printf 'NAVER_CLIENT_SECRET=%s\n' "${naver_client_secret}"
  printf 'ADMIN_BOOTSTRAP_ENABLED=%s\n' "${admin_bootstrap_enabled}"
  printf 'ADMIN_BOOTSTRAP_ID=%s\n' "${admin_bootstrap_id}"
  printf 'ADMIN_BOOTSTRAP_PASSWORD=%s\n' "${admin_bootstrap_password}"
  printf 'KAKAO_REST_API_KEY=%s\n' "${kakao_rest_api_key}"
  printf 'KAKAO_CLIENT_SECRET=%s\n' "${kakao_client_secret}"
  printf 'SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KAKAO_REDIRECT_URI=%s/production-oauth-callback/kakao\n' "${public_origin}"
  printf 'FRONTEND_OAUTH_SUCCESS_URL=%s/\n' "${public_origin}"
  printf 'FRONTEND_OAUTH_FAILURE_URL=%s/login\n' "${public_origin}"
  printf 'JWT_SECRET_BASE64=%s\n' "${jwt_secret}"
  printf 'JWT_ACCESS_TOKEN_EXPIRES=%s\n' "${jwt_access_expires}"
  printf 'JWT_REFRESH_TOKEN_EXPIRES=%s\n' "${jwt_refresh_expires}"
  printf 'JWT_SECURE=%s\n' 'true'
  printf 'SERVER_FORWARD_HEADERS_STRATEGY=%s\n' 'framework'
  printf 'TZ=%s\n' 'Asia/Seoul'
} > "${temporary_file}"

chown root:root "${temporary_file}"
chmod 0600 "${temporary_file}"
mv -f "${temporary_file}" "${runtime_env}"

unset kakao_rest_api_key kakao_client_secret jwt_secret jwt_access_expires jwt_refresh_expires redis_password naver_client_id naver_client_secret admin_bootstrap_enabled admin_bootstrap_id admin_bootstrap_password mysql_password
trap - EXIT

echo "생성: ${runtime_env}"
stat -c '%A %U:%G %n' "${runtime_env}"
awk -F= 'NF >= 2 {print $1 "=<configured>"}' "${runtime_env}"
echo 'Secret 값은 출력하지 않았습니다.'
