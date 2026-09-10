# Amazon ECR 준비 파일

이 디렉터리는 Jenkins가 빌드한 이미지를 개인 AWS의 private ECR에 올리고, SSAFY 서버가 해당 이미지를 내려받는 데 필요한 최소 설정 초안을 보관한다. 실제 Access Key나 AWS 계정 ID는 저장하지 않는다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| jenkins-push-policy.template.json | Jenkins 전용 AWS 자격증명에 부여할 Push 권한 템플릿이다. tashu/* repository에만 이미지를 올릴 수 있다. |
| runtime-pull-policy.template.json | SSAFY 실행 서버용 Pull 권한 템플릿이다. 이미지를 내려받고 조회할 수 있지만 Push와 삭제는 할 수 없다. |
| lifecycle-policy.json | 각 repository에서 untagged image는 1일 뒤 삭제하고, tagged image는 최신 10개만 남긴다. |
| create-repositories.sh | AWS CLI로 현재 필요한 repository 두 개를 생성하고 tag 불변성·scan·보관 정책을 반복 적용한다. |

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
- Jenkins와 실행 서버는 서로 다른 AWS 자격증명을 사용한다.
- 실제 생성과 IAM 연결은 AWS Console 단계에서 사용자가 항목을 확인하며 진행한다.
