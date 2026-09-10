# Jenkins CI Pipeline

이 디렉터리는 저장소 루트 `Jenkinsfile`이 서비스 검증에 사용하는 일회용 Docker build 환경을 보관한다. 애플리케이션 소스와 Secret은 이곳에 넣지 않는다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `frontend.Dockerfile` | Node.js 22 LTS 환경에서 `npm ci`, lint와 production build를 실행한다. |
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
- `tashu-ci` Multibranch Pipeline과 2분 branch scan으로 Build #2~#6 `SUCCESS` 확인
- Backend Gradle 9.7.1 Wrapper 설정을 복구했고 Build #4~#6에서 Backend test 단계 실제 실행 확인
- 최신 `develop`의 프론트 변경을 병합한 Build #6에서 Collector·Frontend·Backend와 Post Actions 모두 `SUCCESS` 확인
- Backend Health endpoint 구현은 백엔드 담당 영역이며, 인프라는 합의된 endpoint를 staging·Blue/Green 배포 검증에 사용
- GitLab Webhook과 ECR·staging 배포는 후속 단계

실제 token과 비밀번호는 이 디렉터리나 Jenkinsfile에 기록하지 않는다.
