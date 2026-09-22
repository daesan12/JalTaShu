#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo '사용법: deploy-staging.sh <full-ecr-ai-serving-image-uri>' >&2
  exit 1
fi

readonly image="$1"
readonly runtime_dir="${TASHU_AI_RUNTIME_DIR:-/opt/tashu/infra/runtime/ai-serving}"
readonly db_env_file="${TASHU_AI_DB_ENV_FILE:-/etc/tashu/ai-serving/mysql-reader.env}"
readonly redis_env_file="${TASHU_AI_REDIS_ENV_FILE:-/etc/tashu/ai-serving/redis.env}"
readonly model_dir="${TASHU_AI_MODEL_DIR:-/srv/tashu/ai-serving/models}"

if [[ ${image} != *.dkr.ecr.ap-northeast-2.amazonaws.com/tashu/ai:* ]]; then
  echo '서울 리전의 tashu/ai ECR image만 배포할 수 있습니다.' >&2
  exit 1
fi

for required_file in "${db_env_file}" "${redis_env_file}"; do
  if [[ ! -s ${required_file} ]]; then
    echo "AI 접속 환경파일이 없습니다: ${required_file}" >&2
    exit 1
  fi
  if [[ $(stat -c '%a' "${required_file}") != 600 || $(stat -c '%U:%G' "${required_file}") != root:root ]]; then
    echo "AI 접속 환경파일 권한은 0600 root:root여야 합니다: ${required_file}" >&2
    exit 1
  fi
done

for model in lgbm_lambda.joblib lgbm_mu.joblib station_profile.parquet; do
  if [[ ! -r ${model_dir}/${model} ]]; then
    echo "AI 모델 파일이 없습니다: ${model_dir}/${model}" >&2
    exit 1
  fi
done

if ! docker image inspect "${image}" >/dev/null 2>&1; then
  echo "먼저 ECR image를 pull해야 합니다: ${image}" >&2
  exit 1
fi

# Secret 값은 출력하지 않고 실제 MySQL SELECT와 Redis PING만 검증한다.
docker run --rm \
  --env-file "${db_env_file}" \
  --env-file "${redis_env_file}" \
  --entrypoint python \
  "${image}" \
  -c 'import os, pymysql, redis; db=pymysql.connect(host=os.environ["TASHU_AI_DB_HOST"], port=int(os.environ.get("TASHU_AI_DB_PORT", "3306")), user=os.environ["TASHU_AI_DB_USER"], password=os.environ["TASHU_AI_DB_PASSWORD"], database=os.environ["TASHU_AI_DB_NAME"], connect_timeout=5); db.cursor().execute("SELECT 1"); db.close(); r=redis.Redis(host=os.environ["TASHU_AI_REDIS_HOST"], port=int(os.environ.get("TASHU_AI_REDIS_PORT", "6379")), db=int(os.environ["TASHU_AI_REDIS_DB"]), password=os.environ["TASHU_AI_REDIS_PASSWORD"], socket_connect_timeout=5); assert r.ping(); print("AI MySQL SELECT / Redis PING: OK")'

cd "${runtime_dir}"
AI_SERVING_IMAGE="${image}" \
AI_DB_ENV_FILE="${db_env_file}" \
AI_REDIS_ENV_FILE="${redis_env_file}" \
AI_MODEL_DIR="${model_dir}" \
  docker compose --file compose.yml up -d

echo "AI serving 배포 요청 완료: ${image}"
