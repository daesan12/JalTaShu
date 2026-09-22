#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
fi

readonly runtime_dir="${TASHU_AI_RUNTIME_DIR:-/opt/tashu/infra/runtime/ai-serving}"
readonly aws_env_file="${TASHU_AI_AWS_ENV_FILE:-/etc/tashu/ai-serving/aws-model-reader.env}"
readonly model_dir="${TASHU_AI_MODEL_DIR:-/srv/tashu/ai-serving/models}"
readonly manifest="${runtime_dir}/model-manifest.v1.sha256"

for required_file in "${aws_env_file}" "${manifest}"; do
  if [[ ! -s ${required_file} ]]; then
    echo "필수 파일이 없습니다: ${required_file}" >&2
    exit 1
  fi
done

set -a
# root 소유 0600 파일이며 키 값을 출력하지 않는다.
source "${aws_env_file}"
set +a

: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID가 없습니다}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY가 없습니다}"
: "${MODEL_S3_PATH:?MODEL_S3_PATH가 없습니다}"
export AWS_EC2_METADATA_DISABLED=true AWS_PAGER=''

case "${MODEL_S3_PATH}" in
  s3://*/tashu-ai-models/v1|s3://*/tashu-ai-models/v1/) ;;
  *)
    echo 'MODEL_S3_PATH는 tashu-ai-models/v1 경로여야 합니다.' >&2
    exit 1
    ;;
esac

install -d -o root -g root -m 0755 "$(dirname -- "${model_dir}")"
temporary_dir="$(mktemp -d "$(dirname -- "${model_dir}")/.models.XXXXXX")"
trap 'rm -rf -- "${temporary_dir}"' EXIT

for file_name in lgbm_lambda.joblib lgbm_mu.joblib station_profile.parquet; do
  aws s3 cp \
    "${MODEL_S3_PATH%/}/${file_name}" \
    "${temporary_dir}/${file_name}" \
    --only-show-errors
done

(
  cd "${temporary_dir}"
  sha256sum --check "${manifest}"
)

install -d -o root -g root -m 0755 "${model_dir}"
for file_name in lgbm_lambda.joblib lgbm_mu.joblib station_profile.parquet; do
  install -o root -g root -m 0444 \
    "${temporary_dir}/${file_name}" \
    "${model_dir}/${file_name}"
done

echo "AI 모델 동기화·SHA-256 검증 완료: ${model_dir}"
