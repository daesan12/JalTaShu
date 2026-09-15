# Amazon ECR 준비 파일

이 디렉터리는 Jenkins가 빌드한 이미지를 개인 AWS의 private ECR에 올리고, SSAFY 서버가 해당 이미지를 내려받는 데 필요한 최소 설정 초안을 보관한다. 실제 Access Key나 AWS 계정 ID는 저장하지 않는다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| jenkins-push-policy.template.json | Jenkins 전용 AWS 자격증명에 부여할 Push 권한 템플릿이다. tashu/* repository에만 이미지를 올릴 수 있다. |
| runtime-pull-policy.template.json | SSAFY 실행 서버용 Pull 권한 템플릿이다. 이미지를 내려받고 조회할 수 있지만 Push와 삭제는 할 수 없다. |
| lifecycle-policy.json | 각 repository에서 untagged image는 1일 뒤 삭제하고, tagged image는 최신 10개만 남긴다. |
| registry-scanning-configuration.json | ECR 레지스트리에서 `tashu/*` repository만 Push 시 기본 취약점 스캔하도록 지정한다. |
| create-repositories.sh | AWS CLI로 현재 필요한 repository 두 개를 생성하고 tag 불변성·보관 정책·레지스트리 스캔 정책을 반복 적용한다. |
| scripts/configure-runtime-pull-credential.sh | Server A의 ECR Pull 전용 Access Key를 기존 S3 자격증명과 분리해 입력한다. |
| scripts/verify-runtime-pull-access.sh | ECR 인증·조회 허용과 S3 전체 조회 거부를 확인한다. |
| scripts/pull-runtime-image.sh | 임시 Docker 인증 설정으로 Commit SHA 이미지를 Pull한 뒤 로그인 정보를 제거한다. |

## 첫 단계에 생성할 private repository

- tashu/frontend
- tashu/backend

AI·Collector·Streaming은 실제 runtime image가 생긴 뒤 같은 기준으로 추가한다. 빈 repository는 비용이 거의 없지만, 지금 사용하지 않는 구성을 미리 늘리지 않는다.

## 이후 필요할 repository

- tashu/ai
- tashu/collector
- tashu/streaming

현재 이미지가 준비된 서비스부터 repository를 만들 수 있다. 빈 repository 자체에는 이미지 저장 비용이 발생하지 않는다.

## 적용 전 치환

두 IAM policy 템플릿의 ACCOUNT_ID는 실제 12자리 AWS Account ID로 바꾼 사본에만 적용한다. Account ID가 들어간 렌더링 결과와 Access Key는 Git에 추가하지 않는다.

## 선택 기준

- Region은 프로젝트 S3와 같은 ap-northeast-2로 고정한다.
- repository는 private으로 만든다.
- Commit SHA 기반의 고유 tag를 사용하고 latest를 배포 기준으로 사용하지 않는다.
- tag immutability를 활성화해 같은 tag 덮어쓰기를 막는다.
- 기본 암호화 AES-256을 사용한다.
- Repository별 `scanOnPush` 설정은 deprecated이므로 사용하지 않는다. 레지스트리 수준에서 Basic scanning과 `tashu/*` Push 시 스캔 규칙을 적용한다.
- Enhanced scanning은 Amazon Inspector 비용이 발생할 수 있어 현재 3주 프로젝트 범위에서는 사용하지 않는다.
- Jenkins와 실행 서버는 서로 다른 AWS 자격증명을 사용한다.
- 실제 생성과 IAM 연결은 AWS Console 단계에서 사용자가 항목을 확인하며 진행한다.

## 2026-09-10 AWS Console 검증 상태

- 서울 리전에 `tashu/frontend`, `tashu/backend` private repository를 생성했다.
- 두 repository에서 image tag 불변성과 AES-256 기본 암호화를 확인했다.
- 레지스트리 수준 Basic scanning에서 `tashu/*` Push 시 스캔 규칙을 확인했다.
- 두 repository에 untagged image 1일 만료와 tagged image 최신 10개 보관 정책을 적용했다.
- 실제 Commit SHA image Push와 스캔 결과 확인은 Jenkins Credential 연결 후 진행한다.
## Server A Pull 자격증명

Server A에는 S3 Bronze 동기화용 AWS 자격증명이 이미 있다. ECR Pull 키를 기본 profile에 덮어쓰지 않고 `/etc/tashu/ecr-pull/credentials`에 별도로 저장한다.

```bash
sudo /opt/tashu/infra/aws/ecr/scripts/configure-runtime-pull-credential.sh
sudo /opt/tashu/infra/aws/ecr/scripts/verify-runtime-pull-access.sh
```

자격증명 파일은 `root:root`, mode `0600`이며 Git에 포함하지 않는다. 검증 스크립트는 Secret 값을 출력하지 않고 다음 항목만 확인한다.

- AWS STS 인증 주체 확인
- ECR authorization token 발급 가능
- `tashu/frontend`, `tashu/backend` image 조회 가능
- S3 전체 bucket 조회 불가

ECR image를 Pull할 때는 repository와 불변 tag를 명시한다.

```bash
sudo /opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh tashu/frontend <COMMIT_SHA_TAG>
sudo /opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh tashu/backend <COMMIT_SHA_TAG>
```

스크립트는 `/run` 아래에 임시 Docker config를 만들고 ECR 로그인 토큰을 저장한다. Pull 완료 여부와 관계없이 trap으로 logout하고 임시 디렉터리를 삭제한다. AWS ECR authorization token의 유효기간은 12시간이지만 이 구성은 실행이 끝난 뒤 즉시 폐기한다.

허용 repository는 `tashu/frontend`, `tashu/backend` 두 개다. `latest` 대신 Jenkins가 생성한 Commit SHA tag를 사용한다.

## 공식 자료

- [Amazon ECR private registry authentication](https://docs.aws.amazon.com/AmazonECR/latest/userguide/registry_auth.html)
- [Amazon ECR service authorization reference](https://docs.aws.amazon.com/service-authorization/latest/reference/list_ecr.html)
