#!/usr/bin/env bash
set -euo pipefail

readonly container_name="${MYSQL_CONTAINER_NAME:-tashu-mysql}"
readonly secret_dir="${MYSQL_SECRET_DIR:-/etc/tashu/mysql}"

read_secret() {
  local secret_path="$1"
  local secret_value

  if [[ ! -r "${secret_path}" ]]; then
    echo "읽을 수 없는 Secret 파일: ${secret_path}" >&2
    exit 1
  fi

  secret_value="$(<"${secret_path}")"
  if [[ ! "${secret_value}" =~ ^[0-9a-fA-F]{48}$ ]]; then
    echo "예상한 형식이 아닌 Secret: ${secret_path}" >&2
    exit 1
  fi

  printf '%s' "${secret_value}"
}

mysql_as() {
  local user_name="$1"
  local password="$2"
  shift 2

  docker exec \
    --env MYSQL_PWD="${password}" \
    "${container_name}" \
    mysql --user="${user_name}" --batch --skip-column-names "$@"
}

readonly root_password="$(read_secret "${secret_dir}/root-password")"
readonly prod_password="$(read_secret "${secret_dir}/prod-password")"
readonly staging_password="$(read_secret "${secret_dir}/staging-password")"

echo "DB 목록:"
mysql_as root "${root_password}" --execute="
  SELECT SCHEMA_NAME
  FROM INFORMATION_SCHEMA.SCHEMATA
  WHERE SCHEMA_NAME IN ('tashu_prod', 'tashu_staging')
  ORDER BY SCHEMA_NAME;"

echo "전용 사용자 목록:"
mysql_as root "${root_password}" --execute="
  SELECT USER, HOST
  FROM mysql.user
  WHERE USER IN ('tashu_prod_user', 'tashu_staging_user')
  ORDER BY USER;"

mysql_as tashu_prod_user "${prod_password}" \
  --database=tashu_prod --execute='SELECT DATABASE();' >/dev/null
echo "성공: production 사용자가 tashu_prod에 접근"

mysql_as tashu_staging_user "${staging_password}" \
  --database=tashu_staging --execute='SELECT DATABASE();' >/dev/null
echo "성공: staging 사용자가 tashu_staging에 접근"

if mysql_as tashu_prod_user "${prod_password}" \
  --database=tashu_staging --execute='SELECT DATABASE();' >/dev/null 2>&1; then
  echo "실패: production 사용자가 tashu_staging에 접근했습니다." >&2
  exit 1
fi
echo "차단 확인: production 사용자는 tashu_staging에 접근 불가"

if mysql_as tashu_staging_user "${staging_password}" \
  --database=tashu_prod --execute='SELECT DATABASE();' >/dev/null 2>&1; then
  echo "실패: staging 사용자가 tashu_prod에 접근했습니다." >&2
  exit 1
fi
echo "차단 확인: staging 사용자는 tashu_prod에 접근 불가"
