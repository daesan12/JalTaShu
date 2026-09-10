# Jenkins Controller baseline

Server B에서 Jenkins Controller와 Docker Build Agent를 분리해 실행한다. Controller는 작업을 예약하고 설정·결과를 보관하며, 실제 Git checkout과 Docker build는 Agent 한 개가 수행한다.

## 구조

```text
PC --SSH tunnel--> 127.0.0.1:8080 on Server B
                              |
                    Jenkins Controller
                    built-in executors: 0
                    volume: tashu-jenkins-home
                              |
                    Docker Build Agent
                    executor: 1
                    volume: tashu-jenkins-agent-work
```

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `compose.yml` | Controller의 loopback 포트, 메모리·CPU, health check, volume과 Secret mount |
| `.env.example` | Secret 디렉터리, 그룹 GID, Docker socket GID와 Agent 공개키 형식 예시 |
| `controller/Dockerfile` | 고정 Jenkins LTS·JDK 21 이미지에 플러그인과 JCasC 설정 포함 |
| `controller/plugins.txt` | Pipeline, GitLab, Docker, SSH, JUnit, workspace 정리, lock 플러그인 목록 |
| `controller/jenkins.yaml` | 가입 차단, 로그인 필수, built-in executor 0, Agent node와 전용 credential 설정 |
| `agent/Dockerfile` | 공식 Jenkins SSH Agent JDK 21 image에 Git과 Docker CLI·Buildx·Compose 추가 |
| `agent/README.md` | Agent 권한, 내부 연결, workspace와 포함 도구 설명 |
| `scripts/generate-secrets.sh` | 관리자 비밀번호, Agent 전용 SSH key pair와 Compose runtime 환경파일 생성 |
| `scripts/configure-gitlab-credential.sh` | GitLab Deploy Token을 화면에 출력하지 않고 JCasC용 Secret 파일 두 개로 저장 |
| `scripts/configure-ecr-credential.sh` | ECR Push 전용 AWS Access Key를 화면에 출력하지 않고 JCasC용 Secret 파일 두 개로 저장 |

## 왜 built-in executor를 0으로 두는가

Controller에 executor가 있으면 Git repository의 임의 build script가 Controller 내부에서 실행된다. 또한 무거운 build가 UI와 작업 예약에 필요한 CPU·메모리를 함께 사용한다. Controller는 조정만 하고 build는 전용 Agent 한 개가 수행하게 분리한다.

## 보안 기준

- `8080`은 `127.0.0.1`에만 publish한다. UFW에 Jenkins 포트를 추가하지 않는다.
- PC에서는 SSH tunnel을 연 동안만 Jenkins UI에 접근한다.
- 관리자 비밀번호는 `/etc/tashu/jenkins/admin-password`에 두고 Git과 Compose에 적지 않는다.
- Controller에는 Docker socket을 mount하지 않는다.
- Agent의 SSH 22번 포트는 Docker network 안에서만 사용하며 host에 publish하지 않는다.
- Agent 전용 private key는 `/etc/tashu/jenkins/agent-ed25519`에 저장하고 기존 SSAFY PEM을 Jenkins에 넣지 않는다.
- Agent는 Docker socket을 제어할 수 있으므로 신뢰하는 팀 repository만 build한다.
- 회원가입과 익명 읽기를 막는다.
- Controller의 built-in executor는 0이다.

## Secret 읽기 방식

Compose의 file secret은 호스트 파일 권한을 그대로 사용할 수 있다. `generate-secrets.sh`는 전용 `tashu-jenkins` 그룹을 만들고 관리자 비밀번호와 Agent private key를 `0640 root:tashu-jenkins`로 저장한다. Compose는 해당 그룹 GID를 Controller의 supplemental group으로 추가한다. Agent에는 공개키만 환경변수로 전달한다.

## 자원 기준

- JVM heap: 512MiB 시작, 최대 1536MiB
- 컨테이너 메모리: 최대 2GiB
- CPU: 최대 1.5개
- Jenkins home: `tashu-jenkins-home` named volume
- Agent executor: 1개
- Agent 컨테이너: CPU 최대 1.5개, 메모리 최대 2GiB
- Agent workspace: `tashu-jenkins-agent-work` named volume

Agent와 관측성, 이후 Kafka·Spark가 같은 Server B를 사용하므로 작은 값으로 시작하고 실제 지표를 보고 조정한다.

## 설치 체크포인트

1. Server B의 `/opt/tashu/jenkins`에 이 설정을 전달한다.
2. Secret 생성 후 값이 아닌 파일 소유권·권한만 확인한다.
3. `docker compose config`로 최종 설정을 검증한다.
4. 이미지를 build하고 Controller가 `healthy`가 되는지 확인한다.
5. SSH tunnel로 UI에 로그인하고 built-in executor가 0인지 확인한다.
6. Agent가 `online`이고 Java·Git·Docker 명령을 실행하는지 확인한다.
7. Controller와 Agent 재시작 뒤 node 연결과 두 volume의 유지 여부를 확인한다.

## Pipeline 코드 상태

- 저장소 루트 Jenkinsfile과 pipeline/의 서비스별 Docker build 환경을 추가했다.
- Collector test와 Node 22 Frontend lint·build는 실행 가능한 기준선을 확인했다.
- Backend Gradle 9.7.1 Wrapper를 복구했고 Build #4~#6에서 Backend test가 실제 실행됐다.
- ECR 연동 세대는 Controller image `2.568.3-5`, AWS CLI `2.36.42`가 추가된 Agent image `3`을 사용한다. 이전 운영 image `2.568.3-4`와 `2`는 rollback 기준으로 남긴다.

## Multibranch Pipeline 설정

Jenkins UI의 `tashu-ci` Job은 다음 값으로 구성했다.

| 항목 | 값과 의미 |
| --- | --- |
| Item type | `Multibranch Pipeline`: 브랜치별로 루트 Jenkinsfile을 찾아 별도 Build를 만든다. |
| Branch source | GitLab 프로젝트 HTTPS URL |
| Credential | `gitlab-readonly`: `read_repository`만 가진 Deploy Token을 Jenkins가 암호화해 보관한다. |
| Behaviour | `Discover branches`: 원격 브랜치를 탐색한다. |
| Script Path | `Jenkinsfile`: 저장소 루트의 Pipeline 정의를 사용한다. |
| Scan trigger | `2m` Periodic Folder Trigger. Webhook 연결 전까지 새 Commit을 자동 탐색하는 fallback이다. |

첫 scan은 원격 브랜치 6개를 확인하고 루트 Jenkinsfile이 있는 `chore/#73-jenkins-multibranch-ci`만 Build 대상으로 등록했다. Build #1은 Build Agent에서 Git checkout, Collector 테스트 12개와 Frontend lint·build를 실행해 `SUCCESS`가 됐다. 당시 Backend는 저장소에 `gradle-wrapper.properties`가 없어 명시적으로 보류됐다.

이후 Gradle Wrapper 설정을 복구하고 Frontend CI를 Node 22 LTS로 맞췄다. Build #4부터 Backend Gradle 단계가 실제 실행됐고, 인프라가 추가했던 Backend Health 구현을 제거한 Build #5도 성공했다. 최신 `develop`의 프론트 변경을 병합한 Build #6은 Checkout, Repository contract, Collector tests, Frontend lint·build, Backend test와 Post Actions가 모두 `SUCCESS`였으며 총 49초가 걸렸다. Health endpoint 자체는 백엔드 담당이 구현하고 인프라는 배포 검증에서 사용한다.

프론트 환경별 배포 설정 MR !16이 `develop`에 병합된 뒤 현재 브랜치에도 동기화했다. `VITE_BASE_PATH`와 `VITE_AUTH_BASE_URL` 변경이 포함된 Build #8에서 Frontend lint·build와 Collector·Backend 검증이 모두 `SUCCESS`였다. 따라서 Nginx는 후속 CD 단계에서 `/staging/`, `/staging-api/`, `/staging-auth/` 경로를 연결할 수 있다.

Controller 재시작 시험에서는 Job과 Build 결과는 유지됐지만 UI에서 수동 등록한 `gitlab-readonly` Credential이 JCasC의 선언 목록에 없어 제거됐다. 그 결과 첫 timer scan이 HTTP Basic 인증 실패로 끝났고, 반복 실패를 막기 위해 2분 Polling을 일시 중지했다. 이를 해결하기 위해 Compose가 `/etc/tashu/jenkins/gitlab-username`과 `gitlab-token`을 Docker Secret으로 mount하고, JCasC가 시작할 때마다 동일 ID의 Username/Password Credential을 생성하도록 구성했다. `CASC_STRICT_SECRET_RESOLUTION=true`는 파일이 없을 때 빈 Credential로 덮어쓰지 않고 시작을 실패시킨다.

`configure-gitlab-credential.sh`는 사용자가 서버 터미널에서 값을 직접 입력받아 두 파일을 `0640 root:tashu-jenkins`로 atomic 교체한다. 값은 터미널, Git, 문서와 프로세스 인자에 출력하지 않는다. 운영 적용에서도 값 대신 파일 소유자·권한·크기만 확인했다.

배포 전 검증에서는 실제 Deploy Token 대신 임시 값을 사용했다. Compose 최종 설정과 셸 문법이 통과했고, 새 Controller image `tashu/jenkins-controller:2.568.3-4`가 독립 컨테이너에서 기동해 `gitlab-readonly`를 생성했다. `gitlab-token` 파일을 의도적으로 빼면 strict resolution이 Jenkins 시작을 차단하는 것도 확인했다.

## Credential 영속화 운영 검증

- 설정과 Jenkins home volume을 각각 gzip archive로 백업하고 무결성을 검사했다.
- 운영 Controller를 `2.568.3-4`로 교체한 뒤 `healthy`와 Jenkins 완전 기동 로그를 확인했다.
- Controller를 한 번 더 재시작해 `gitlab-readonly`, `tashu-ci`, Build #1과 Build Agent 연결이 모두 유지되는 것을 확인했다.
- Jenkins·Grafana·Prometheus 관리 UI는 계속 `127.0.0.1`에만 bind하며 UFW를 변경하지 않았다.
- `tashu-ci`에 2분 Periodic Folder Trigger를 다시 등록했다.
## 아직 하지 않는 것

- GitLab Webhook 연결과 Polling fallback 제거
- ECR credential 운영 주입과 실제 `develop` image push 검증
- 배포용 SSH key
- develop의 staging 자동 배포
- Jenkins home 정기 backup
