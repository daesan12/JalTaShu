# Backend staging runtime

Server A에서 ECR의 Backend runtime image를 staging MySQL과 Redis에 연결해 검증한다. Backend 소스와 Secret은 이 디렉터리에 저장하지 않는다.

## 파일 역할

| 경로 | 역할 | Git/Secret |
| --- | --- | --- |
| `compose.staging.yml` | Backend image, loopback port, health check, 자원 제한과 내부 network 정의 | Git 추적, Secret 없음 |
| `scripts/render-staging-env.sh` | 서버에 따로 저장된 MySQL·Redis·JWT·OAuth Secret을 하나의 Backend 환경파일로 조합 | Git 추적, Secret 없음 |
| `scripts/configure-photo-s3-secret.sh` | 사진 bucket 전용 Access Key를 화면에 다시 출력하지 않고 공통 Secret 파일로 저장 | Git 추적, Secret 없음 |
| `scripts/deploy-staging.sh` | 미리 pull한 immutable ECR image로 staging 컨테이너 교체 | Git 추적, Secret 없음 |
| `/etc/tashu/backend-staging/oauth.env` | Backend 팀의 Kakao·Frontend OAuth 설정 | Server A 전용, Git 금지 |
| `/etc/tashu/backend-staging/jwt.env` | JWT 서명키, access·refresh 만료시간과 Secure cookie 여부 | Server A 전용, Git 금지 |
| `/etc/tashu/backend-common/naver-place.env` | Naver Place API Hub의 Client ID와 Client Secret | Server A 전용, Git 금지 |
| `/etc/tashu/backend-common/photo-s3.env` | 사진 업로드 bucket 전용 Access Key ID·Secret Access Key와 Region·Bucket | Server A 전용, Git 금지 |
| `/etc/tashu/backend-staging/runtime.env` | 컨테이너에 전달할 최종 환경변수 | Server A 전용, Git 금지 |

## 연결 구조

```text
127.0.0.1:18081
        │
        ▼
tashu-backend-staging:8080
        │ Docker network: tashu-app
        ├── tashu-mysql:3306 / tashu_staging
        ├── tashu-redis:6379 / database 1
        ├── osrm-foot:5000
        ├── osrm-bicycle:5000
        ├── osrm-uphill:5000
        └── /app/dem (Server A DEM read-only mount)
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
- `/etc/tashu/backend-common/naver-place.env`
- `/etc/tashu/backend-common/photo-s3.env`

실제 값은 출력하지 않고 최종 파일의 변수 이름과 권한만 표시한다.

사진 Secret은 최초 한 번 다음 명령으로 네 값을 저장한다. 이 IAM 사용자는
`tashu-upload-755719633654-ap-northeast-2-an` bucket의 `images/*`에 필요한
최소 권한만 가져야 하며 MySQL backup·ECR 자격증명을 재사용하지 않는다.

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
S3_BUCKET
```

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::tashu-upload-755719633654-ap-northeast-2-an/images/*"
    }
  ]
}
```

```bash
sudo /opt/tashu/infra/runtime/backend/scripts/configure-photo-s3-secret.sh
```

Backend와 관리 화면의 안내를 맞추기 위해 파일 한 개는 최대 5MB, multipart 요청 전체는
6MB로 제한한다. 외부 Nginx의 `client_max_body_size 10m`보다 작으므로 5MB 초과 파일은
Backend에서 일관되게 거부된다.

`jwt.env`에는 `JWT_SECURE=true|false`가 반드시 있어야 한다. 공개 HTTPS staging에서는 `true`를 사용해 브라우저가 JWT cookie를 암호화되지 않은 HTTP 요청에 보내지 않게 한다. 로컬 HTTP 개발처럼 TLS가 없는 환경에서만 `false`를 사용한다.

최종 `runtime.env`에는 `SERVER_FORWARD_HEADERS_STRATEGY=framework`도 고정한다. Backend가 Nginx의 `X-Forwarded-Proto: https`를 사용해 Kakao callback URL을 HTTPS로 생성하기 위한 설정이다. 값은 일반 설정이며 Secret이 아니다.

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
sudo docker inspect tashu-backend-staging --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | awk -F= '/^AWS_/ || /^S3_BUCKET=/ {print $1 "=<configured>"}'
```

OSRM과 DEM 연결은 actuator health만으로 확인되지 않는다. 로그인한 사용자 access token으로
실제 경로 API를 호출해 도보·자전거·오르막 회피 경로와 고도 응답을 확인한다.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  "http://127.0.0.1:18081/api/map/path?startLat=36.3504&startLng=127.3845&endLat=36.3600&endLng=127.4000"
```

Backend container 내부 연결 주소는 세 서비스 모두 port 5000이다. host loopback 점검 port
5000, 5001, 5002를 Backend 환경변수에 넣거나 `localhost`를 사용하지 않는다. DEM은
`/opt/tashu/osrm/osrm-uphill/dem`을 Backend `/app/dem`에 read-only로 mount한다.

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
