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
- Collector test와 Frontend lint·build는 실행 가능한 기준선을 확인했다.
- Backend는 gradle-wrapper.properties가 준비되면 자동으로 test를 실행한다.

## 아직 하지 않는 것

- GitLab 읽기 전용 credential 등록
- Multibranch Pipeline UI 생성과 Poll SCM 검증
- ECR credential과 배포용 SSH key
- Jenkins home 정기 backup
