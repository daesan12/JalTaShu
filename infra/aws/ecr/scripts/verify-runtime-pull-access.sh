#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'root 권한으로 실행해야 합니다: sudo .../verify-runtime-pull-access.sh' >&2
  exit 1
fi

region=${AWS_REGION:-ap-northeast-2}
credential_file=${TASHU_ECR_CREDENTIAL_FILE:-/etc/tashu/ecr-pull/credentials}
repositories=(tashu/frontend tashu/backend)

if [[ ! -s ${credential_file} ]]; then
  echo "ECR Pull 자격증명 파일이 없습니다: ${credential_file}" >&2
  exit 1
fi

file_mode=$(stat -c '%a' "${credential_file}")
file_owner=$(stat -c '%U:%G' "${credential_file}")
if [[ ${file_mode} != 600 || ${file_owner} != root:root ]]; then
  echo "자격증명 권한이 올바르지 않습니다: mode=${file_mode}, owner=${file_owner}" >&2
  exit 1
fi

export AWS_SHARED_CREDENTIALS_FILE=${credential_file}
export AWS_EC2_METADATA_DISABLED=true
export AWS_PAGER=''

principal_arn=$(aws sts get-caller-identity --query Arn --output text)
aws ecr get-login-password --region "${region}" >/dev/null

for repository in "${repositories[@]}"; do
  aws ecr describe-images \
    --region "${region}" \
    --repository-name "${repository}" \
    --max-results 1 \
    >/dev/null
done

if aws s3api list-buckets >/dev/null 2>&1; then
  echo 'ECR Pull 자격증명이 S3 전체 조회도 허용합니다. IAM 정책을 다시 확인하세요.' >&2
  exit 1
fi

echo "AWS 인증 주체 확인: ${principal_arn}"
echo 'ECR 인증 토큰 발급 확인: 성공'
echo 'ECR image 조회 확인: tashu/frontend, tashu/backend 성공'
echo 'S3 전체 bucket 조회 차단 확인: 성공'
echo 'Secret 값은 출력하지 않았습니다.'
