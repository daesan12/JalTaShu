#!/usr/bin/env bash
set -euo pipefail

readonly secret_dir="${TASHU_BACKEND_STAGING_SECRET_DIR:-/etc/tashu/backend-staging}"
readonly oauth_env="${secret_dir}/oauth.env"
readonly jwt_env="${secret_dir}/jwt.env"
readonly mysql_password_file="${TASHU_MYSQL_STAGING_PASSWORD_FILE:-/etc/tashu/mysql/staging-password}"
readonly redis_env="${TASHU_REDIS_ENV_FILE:-/etc/tashu/redis/runtime.env}"
readonly runtime_env="${secret_dir}/runtime.env"
readonly oauth_redirect_uri="${TASHU_STAGING_OAUTH_REDIRECT_URI:-https://j15b103.p.ssafy.io/staging-oauth-callback/kakao}"

read_env_value() {
  local file_path="$1"
  local variable_name="$2"
  local line

  line="$(grep -m1 -E "^${variable_name}=" "${file_path}" || true)"
  if [[ -z "${line}" || -z "${line#*=}" ]]; then
    echo "필수 설정이 없습니다: ${variable_name} (${file_path})" >&2
    exit 1
  fi
  printf '%s' "${line#*=}"
}

for required_file in "${oauth_env}" "${jwt_env}" "${mysql_password_file}" "${redis_env}"; do
  if [[ ! -s "${required_file}" ]]; then
    echo "필수 Secret 파일이 없거나 비어 있습니다: ${required_file}" >&2
    exit 1
  fi
done

install -d -o root -g root -m 0700 "${secret_dir}"

kakao_rest_api_key="$(read_env_value "${oauth_env}" KAKAO_REST_API_KEY)"
kakao_client_secret="$(read_env_value "${oauth_env}" KAKAO_CLIENT_SECRET)"
frontend_success_url="$(read_env_value "${oauth_env}" FRONTEND_OAUTH_SUCCESS_URL)"
frontend_failure_url="$(read_env_value "${oauth_env}" FRONTEND_OAUTH_FAILURE_URL)"
jwt_secret="$(read_env_value "${jwt_env}" JWT_SECRET_BASE64)"
jwt_access_expires="$(read_env_value "${jwt_env}" JWT_ACCESS_TOKEN_EXPIRES)"
jwt_refresh_expires="$(read_env_value "${jwt_env}" JWT_REFRESH_TOKEN_EXPIRES)"
jwt_secure="$(read_env_value "${jwt_env}" JWT_SECURE)"
mysql_password="$(<"${mysql_password_file}")"
redis_password="$(read_env_value "${redis_env}" REDIS_PASSWORD)"

if [[ -z "${mysql_password}" ]]; then
  echo "MySQL staging 비밀번호가 비어 있습니다." >&2
  exit 1
fi

if [[ ${jwt_secure} != true && ${jwt_secure} != false ]]; then
  echo 'JWT_SECURE는 true 또는 false여야 합니다.' >&2
  exit 1
fi

if [[ ! ${oauth_redirect_uri} =~ ^https://[A-Za-z0-9.-]+/staging-oauth-callback/kakao$ ]]; then
  echo 'TASHU_STAGING_OAUTH_REDIRECT_URI 형식이 올바르지 않습니다.' >&2
  exit 1
fi

temporary_file="$(mktemp "${secret_dir}/.runtime.env.XXXXXX")"
trap 'rm -f "${temporary_file:-}"; unset kakao_rest_api_key kakao_client_secret frontend_success_url frontend_failure_url jwt_secret jwt_access_expires jwt_refresh_expires jwt_secure mysql_password redis_password' EXIT

{
  printf 'SPRING_DATASOURCE_URL=%s\n' 'jdbc:mysql://tashu-mysql:3306/tashu_staging?useSSL=false&useUnicode=true&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true'
  printf 'SPRING_DATASOURCE_USERNAME=%s\n' 'tashu_staging_user'
  printf 'SPRING_DATASOURCE_PASSWORD=%s\n' "${mysql_password}"
  printf 'SPRING_DATA_REDIS_HOST=%s\n' 'tashu-redis'
  printf 'SPRING_DATA_REDIS_PORT=%s\n' '6379'
  printf 'SPRING_DATA_REDIS_PASSWORD=%s\n' "${redis_password}"
  printf 'SPRING_DATA_REDIS_DATABASE=%s\n' '1'
  printf 'KAKAO_REST_API_KEY=%s\n' "${kakao_rest_api_key}"
  printf 'KAKAO_CLIENT_SECRET=%s\n' "${kakao_client_secret}"
  printf 'SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KAKAO_REDIRECT_URI=%s\n' "${oauth_redirect_uri}"
  printf 'FRONTEND_OAUTH_SUCCESS_URL=%s\n' "${frontend_success_url}"
  printf 'FRONTEND_OAUTH_FAILURE_URL=%s\n' "${frontend_failure_url}"
  printf 'JWT_SECRET_BASE64=%s\n' "${jwt_secret}"
  printf 'JWT_ACCESS_TOKEN_EXPIRES=%s\n' "${jwt_access_expires}"
  printf 'JWT_REFRESH_TOKEN_EXPIRES=%s\n' "${jwt_refresh_expires}"
  printf 'JWT_SECURE=%s\n' "${jwt_secure}"
  printf 'SERVER_FORWARD_HEADERS_STRATEGY=%s\n' 'framework'
  printf 'TZ=%s\n' 'Asia/Seoul'
} > "${temporary_file}"

chown root:root "${temporary_file}"
chmod 0600 "${temporary_file}"
mv -f "${temporary_file}" "${runtime_env}"

unset kakao_rest_api_key kakao_client_secret frontend_success_url frontend_failure_url jwt_secret jwt_access_expires jwt_refresh_expires jwt_secure mysql_password redis_password
trap - EXIT

echo "생성: ${runtime_env}"
stat -c '%A %U:%G %n' "${runtime_env}"
awk -F= 'NF >= 2 {print $1 "=<configured>"}' "${runtime_env}"
echo 'Secret 값은 출력하지 않았습니다.'
