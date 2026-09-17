#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다: sudo .../pull-runtime-image.sh <repository> <tag>' >&2
  exit 1
fi

if [[ $# -ne 2 ]]; then
  echo "사용법: $0 <tashu/frontend|tashu/backend|tashu/ai> <COMMIT_SHA_TAG>" >&2
  exit 1
fi

repository=$1
image_tag=$2
region=${AWS_REGION:-ap-northeast-2}
credential_file=${TASHU_ECR_CREDENTIAL_FILE:-/etc/tashu/ecr-pull/credentials}

case ${repository} in
  tashu/frontend|tashu/backend|tashu/ai) ;;
  *)
    echo '허용되지 않은 repository입니다. tashu/frontend, tashu/backend 또는 tashu/ai를 사용하세요.' >&2
    exit 1
    ;;
esac

if [[ ! ${image_tag} =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo '올바르지 않은 image tag입니다.' >&2
  exit 1
fi

if [[ ! -s ${credential_file} ]]; then
  echo "ECR Pull 자격증명 파일이 없습니다: ${credential_file}" >&2
  exit 1
fi

export AWS_SHARED_CREDENTIALS_FILE=${credential_file}
export AWS_EC2_METADATA_DISABLED=true
export AWS_PAGER=''

account_id=$(aws sts get-caller-identity --query Account --output text)
registry=${account_id}.dkr.ecr.${region}.amazonaws.com
image_uri=${registry}/${repository}:${image_tag}
docker_config=$(mktemp -d /run/tashu-ecr-docker.XXXXXX)
chmod 0700 "${docker_config}"

cleanup() {
  docker --config "${docker_config}" logout "${registry}" >/dev/null 2>&1 || true
  rm -rf "${docker_config}"
}
trap cleanup EXIT

aws ecr get-login-password --region "${region}" \
  | docker --config "${docker_config}" login \
      --username AWS \
      --password-stdin \
      "${registry}" >/dev/null

docker --config "${docker_config}" pull "${image_uri}"
docker image inspect "${image_uri}" >/dev/null

echo "ECR Pull 검증 완료: ${repository}:${image_tag}"
