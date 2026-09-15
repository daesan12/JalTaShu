# Backend staging runtime

Server A에서 ECR의 Backend runtime image를 staging MySQL과 Redis에 연결해 검증한다. Backend 소스와 Secret은 이 디렉터리에 저장하지 않는다.

## 파일 역할

| 경로 | 역할 | Git/Secret |
| --- | --- | --- |
| `compose.staging.yml` | Backend image, loopback port, health check, 자원 제한과 내부 network 정의 | Git 추적, Secret 없음 |
| `scripts/render-staging-env.sh` | 서버에 따로 저장된 MySQL·Redis·JWT·OAuth Secret을 하나의 Backend 환경파일로 조합 | Git 추적, Secret 없음 |
| `scripts/deploy-staging.sh` | 미리 pull한 immutable ECR image로 staging 컨테이너 교체 | Git 추적, Secret 없음 |
| `/etc/tashu/backend-staging/oauth.env` | Backend 팀의 Kakao·Frontend OAuth 설정 | Server A 전용, Git 금지 |
| `/etc/tashu/backend-staging/jwt.env` | JWT 서명키, access·refresh 만료시간과 Secure cookie 여부 | Server A 전용, Git 금지 |
| `/etc/tashu/backend-staging/runtime.env` | 컨테이너에 전달할 최종 환경변수 | Server A 전용, Git 금지 |

## 연결 구조

```text
127.0.0.1:18081
        │
        ▼
tashu-backend-staging:8080
        │ Docker network: tashu-app
        ├── tashu-mysql:3306 / tashu_staging
        └── tashu-redis:6379 / database 1
```

`18081`은 Server A loopback에만 bind한다. 외부 Nginx를 연결하기 전에는 인터넷에서 접근할 수 없고 UFW 규칙도 추가하지 않는다.

## 환경파일 생성

```bash
sudo /opt/tashu/infra/runtime/backend/scripts/render-staging-env.sh
```

이 스크립트는 다음 기존 파일을 읽는다.

- `/etc/tashu/mysql/staging-password`
- `/etc/tashu/redis/runtime.env`
- `/etc/tashu/backend-staging/jwt.env`
- `/etc/tashu/backend-staging/oauth.env`

실제 값은 출력하지 않고 최종 파일의 변수 이름과 권한만 표시한다.

`jwt.env`에는 `JWT_SECURE=true|false`가 반드시 있어야 한다. 공개 HTTPS staging에서는 `true`를 사용해 브라우저가 JWT cookie를 암호화되지 않은 HTTP 요청에 보내지 않게 한다. 로컬 HTTP 개발처럼 TLS가 없는 환경에서만 `false`를 사용한다.

최종 `runtime.env`에는 `SERVER_FORWARD_HEADERS_STRATEGY=framework`도 고정한다. Backend가 Nginx의 `X-Forwarded-Proto: https`를 사용해 Kakao callback URL을 HTTPS로 생성하기 위한 설정이다. 값은 일반 설정이며 Secret이 아니다.

같은 도메인의 production callback과 충돌하지 않도록 staging은 다음 redirect URI를 명시한다.

```text
https://j15b103.p.ssafy.io/staging-oauth-callback/kakao
```

Nginx는 이 외부 경로를 staging Backend의 `/api/auth/oauth/callback/kakao`로 전달한다. Kakao 개발자 콘솔에도 이 URI가 등록되어야 한다.

## image pull과 배포

```bash
sudo /opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh tashu/backend <COMMIT_SHA_TAG>
sudo /opt/tashu/infra/runtime/backend/scripts/deploy-staging.sh \
  <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tashu/backend:<COMMIT_SHA_TAG>
```

`latest`가 아니라 Commit SHA tag를 사용한다. `deploy-staging.sh`는 image가 로컬 Docker에 이미 존재하는지 확인하고 `pull_policy: never`로 예상하지 않은 image 변경을 막는다.

## 검증

```bash
sudo docker compose --file /opt/tashu/infra/runtime/backend/compose.staging.yml ps
curl --fail --silent http://127.0.0.1:18081/api/actuator/health
sudo docker inspect --format '{{.State.Health.Status}}' tashu-backend-staging
```

정상 결과는 HTTP 200, body의 `{"status":"UP"}`, Docker health `healthy`다.

## 중지와 복구

```bash
sudo docker stop tashu-backend-staging
sudo docker start tashu-backend-staging
```

이 staging 컨테이너는 production Blue/Green 트래픽을 받지 않는다. 배포 실패 시 staging 컨테이너만 제거하고 기존 production 서비스와 MySQL·Redis는 유지한다.

## 검증된 결과 (2026-09-14)

- Commit SHA `8a2699a694ec`의 Backend runtime image build와 ECR Push 성공
- Server A의 ECR Pull 전용 권한으로 동일 image pull 성공
- `tashu_staging` 연결과 Hibernate table 12개 생성 확인
- Docker health `healthy`, `/api/actuator/health` HTTP 200·`UP` 확인
- Backend 컨테이너 재시작 후 health 복구 확인
- Redis 중단 시 HTTP 503·`DOWN`, Redis 복구 후 HTTP 200·`UP` 확인
- `127.0.0.1:18081`만 listen하며 외부 UFW 규칙을 추가하지 않음

이 검증은 staging runtime의 수동 배포 기준선이다. Jenkins 자동 staging 배포와 OAuth 전체 흐름은 후속 단계에서 검증한다.

## Jenkins 자동 staging 배포

Jenkins는 SSAFY 제공 PEM을 사용하지 않는다. Server B에서 별도의 Ed25519 key pair를 만들고, Server A의 `tashu-deploy` 계정에는 공개키만 등록한다.

`tashu-deploy`의 `authorized_keys`에는 SSH forwarding과 PTY를 막는 `restrict`와 강제 명령을 적용한다. 원격에서 허용되는 요청은 다음 한 가지뿐이다.

```text
deploy-backend <12자리 Git SHA>
```

`ssh-deploy-command.sh`가 명령 형식을 검사한 뒤 `jenkins-deploy-staging.sh`만 제한적으로 sudo 실행한다. 배포 사용자는 Docker group과 일반 sudo 권한을 갖지 않는다.

`jenkins-deploy-staging.sh`는 다음 순서로 동작한다.

1. Commit SHA와 동시 배포 lock 검사
2. Server A Pull 전용 IAM으로 ECR image pull
3. Backend staging 컨테이너 교체
4. Docker health와 `/api/actuator/health` 확인
5. 실패하면 배포 직전 image로 복구

Jenkins Agent는 `/etc/ssh/ssh_known_hosts`에 고정된 Server A Ed25519 host key만 신뢰한다. 키가 바뀌면 자동 배포를 중단하며 새 host key를 확인하기 전까지 우회하지 않는다.
