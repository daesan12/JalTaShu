# Jenkins CI Pipeline

이 디렉터리는 저장소 루트 `Jenkinsfile`이 서비스 검증에 사용하는 일회용 Docker build 환경을 보관한다. 애플리케이션 소스와 Secret은 이곳에 넣지 않는다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `frontend.Dockerfile` | Node.js 22 LTS 환경에서 `npm ci` 후 test, lint, production build를 차례로 실행한다. |
| `collector.Dockerfile` | Python 3.12 환경에서 Collector 의존성을 설치하고 단위 테스트 12개를 실행한다. |
| `backend.Dockerfile` | Java 21 환경에서 Gradle Wrapper test를 실행한다. Wrapper 설정이 있으면 Jenkins가 Backend 단계도 자동 실행한다. |

## 실행 원리

Jenkins Controller는 빌드를 실행하지 않는다. `docker` label의 Build Agent가 저장소를 checkout하고 Docker daemon에 각 build context를 전달한다. 테스트와 빌드는 image 내부에서 실행되므로 Node와 Python 패키지가 Agent 운영환경에 설치되지 않는다.

첫 단계에서는 저장소 규모가 작아 모든 서비스를 순서대로 확인한다. 변경 경로 감지는 Pipeline이 안정적으로 실행된 뒤 추가한다. Docker build와 이후 Spark benchmark가 Server B 자원을 동시에 사용하지 않도록 `server-b-heavy` lock을 사용한다.

## 고정한 도구 버전

- Frontend: `node:22.23.2-bookworm-slim`
- Collector: `python:3.12.14-slim-bookworm`
- Backend: `eclipse-temurin:21.0.12_8-jdk-noble`

## 외부 설정 상태

- `gitlab-readonly` Credential을 Docker Secret과 JCasC로 관리하며 Controller 재시작 후 유지됨을 확인
- `tashu-ci` Multibranch Pipeline과 2분 branch scan으로 Build #2~#8 `SUCCESS` 확인
- Backend Gradle 9.7.1 Wrapper 설정을 복구했고 Build #4~#6에서 Backend test 단계 실제 실행 확인
- 최신 `develop`의 프론트 변경을 병합한 Build #6에서 Collector·Frontend·Backend와 Post Actions 모두 `SUCCESS` 확인
- 프론트 환경별 배포 설정 MR !16의 `VITE_BASE_PATH`·`VITE_AUTH_BASE_URL` 변경을 포함한 Build #8 `SUCCESS` 확인
- Backend Health endpoint 구현은 백엔드 담당 영역이며, 인프라는 합의된 endpoint를 staging·Blue/Green 배포 검증에 사용
- GitLab Webhook과 ECR·staging 배포는 후속 단계

실제 token과 비밀번호는 이 디렉터리나 Jenkinsfile에 기록하지 않는다.

## ECR stage

기능 브랜치와 MR은 Service CI까지만 수행한다. `develop` Job만 테스트가 모두 성공한 뒤 배포용 Frontend·Backend image를 추가로 빌드하고 private ECR에 Push한다.

Frontend CI 순서는 `npm ci → npm test → npm run lint → npm run build`다. `npm ci`가 lock file에 고정된 의존성을 깨끗하게 설치하고, 테스트나 정적 검사 중 하나라도 실패하면 뒤 단계와 image push를 실행하지 않는다.
날짜 테스트가 개발 PC와 Linux CI의 기본 시간대 차이로 달라지지 않도록 테스트 컨테이너의 `TZ`는 서비스 기준 시간대인 `Asia/Seoul`로 고정한다.

- Credential ID: `aws-ecr-push`
- Region: `ap-northeast-2`
- Tag: Git Commit SHA 앞 12자리
- Frontend build: `/staging/`, `/staging-api`, `/staging-auth`, MSW 비활성화
- Repository: `tashu/frontend`, `tashu/backend`
- Agent AWS CLI: `2.36.42`

Jenkins Agent의 AWS CLI가 `sts`로 자격증명을 확인하고, ECR에 같은 tag가 실제로 조회되는 데까지 성공해야 Stage가 끝난다. ECR tag immutability 때문에 같은 Commit SHA를 덮어쓸 수 없으며, 동일 Commit을 재실행하면 기존 image를 확인하고 Push를 건너뛴다.

Commit `ede0cba`를 감지한 작업 브랜치 Build #10은 19.3초 만에 기존 CI가 모두 성공했다. ECR Stage는 `develop`이 아닌 브랜치에서 `NOT_EXECUTED`가 되어 AWS로 image를 보내지 않는 조건도 확인했다.
