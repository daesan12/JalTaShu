# Jenkins Docker Build Agent

이 디렉터리는 Jenkins Controller와 분리된 빌드 작업자 이미지를 정의한다.

## 파일

- `Dockerfile`: 공식 Jenkins SSH Agent JDK 21 이미지에 Git과 Docker CLI·Buildx·Compose를 추가하고 전용 진입 스크립트를 등록한다.
- `entrypoint.sh`: Agent가 시작될 때 host Docker socket의 GID를 검사하고 `jenkins` 사용자를 그 그룹에 넣은 후 SSH 서버를 시작한다.
- `.dockerignore`: Docker build context에 `Dockerfile`과 `entrypoint.sh` 이외의 로컬 파일이 들어가지 않게 한다.

## 실행 구조

- Controller는 Docker network의 `agent:22`로만 SSH 접속한다.
- Agent SSH 포트는 Server B host나 인터넷에 publish하지 않는다.
- Agent의 executor는 1개라서 무거운 Docker build를 동시에 실행하지 않는다.
- `/var/run/docker.sock`을 mount하므로 Agent에서 실행된 팀 Pipeline은 Server B Docker를 제어할 수 있다. 신뢰하는 팀 저장소만 빌드한다.
- Compose가 host socket GID를 `DOCKER_GID`로 전달한다. `entrypoint.sh`는 실제 socket GID와 일치할 때만 Agent를 시작한다.
- workspace는 `tashu-jenkins-agent-work` named volume에 보존한다.

## `entrypoint.sh`가 필요한 이유

Compose의 `group_add`만 사용하면 컨테이너 시작 프로세스에는 Docker 그룹이 붙지만, SSH로 로그인한 `jenkins` 세션에서 해당 보조 그룹이 사라질 수 있다. 전용 스크립트는 컨테이너의 `/etc/group`에 host Docker GID를 등록하고 `jenkins` 계정의 실제 그룹 구성에 반영한다.

## 아직 포함하지 않은 도구

Node.js와 Python은 Agent 이미지에 미리 넣지 않는다. 각 서비스의 multi-stage Dockerfile 안에서 필요한 버전을 고정해 빌드하는 것을 기본으로 한다. 실제 Pipeline이 호스트형 Node/Python을 요구할 때만 추가한다.
