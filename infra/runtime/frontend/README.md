# Frontend runtime image

React/Vite 결과물을 빌드한 뒤 외부 Nginx가 프록시할 수 있는 내부 HTTP 서버로 제공한다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `Dockerfile` | Node 22에서 React를 빌드하고 결과물만 non-root Nginx image에 복사한다. |
| `default.conf` | 8080 포트, `/health`, React Router용 SPA fallback을 정의한다. |
| `compose.staging.yml` | Server A loopback `127.0.0.1:18080`에서 Frontend staging 컨테이너를 실행한다. |
| `scripts/deploy-staging.sh` | 이미 내려받은 immutable ECR image로 Frontend 컨테이너를 교체한다. |
| `scripts/jenkins-deploy-staging.sh` | ECR Pull, Health Check, 실패 시 이전 image 복구를 수행한다. |

## staging build contract

```text
VITE_API_BASE_URL=/staging-api
VITE_AUTH_BASE_URL=/staging-auth
VITE_BASE_PATH=/staging/
VITE_ENABLE_MSW=false
```

Jenkins가 저장소 루트를 Docker build context로 사용한다. 루트 `.dockerignore`는 build에 `frontend/`와 이 디렉터리만 전달해 다른 서비스 파일과 Secret이 이미지에 섞이는 것을 막는다.

이 컨테이너는 API reverse proxy와 공개 TLS를 담당하지 않는다. Server A의 외부 Nginx가 `/staging/` 요청의 prefix를 제거해 이 컨테이너의 8080 포트로 전달한다.

## staging 실행

```bash
sudo /opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh \
  tashu/frontend <12자리-Git-SHA>

sudo /opt/tashu/infra/runtime/frontend/scripts/deploy-staging.sh \
  <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tashu/frontend:<12자리-Git-SHA>
```

`latest` 대신 Commit SHA tag를 사용한다. 컨테이너는 호스트의 loopback 포트에만 bind하므로 외부 인터넷에서 `18080`으로 직접 접근할 수 없다.

## 확인

```bash
sudo docker compose \
  --file /opt/tashu/infra/runtime/frontend/compose.staging.yml \
  ps

curl --fail http://127.0.0.1:18080/health
curl --fail http://127.0.0.1:18080/
```

정상 결과는 컨테이너가 `healthy`, `/health`가 `ok`, 내부 `/`가 HTML을 반환하는 상태다. 외부 `/staging/` 경로와 asset은 Server A Nginx가 prefix를 제거하도록 연결한 뒤 별도로 검증한다.

## Jenkins 자동 배포

Jenkins는 `develop` Pipeline에서 Frontend image Push가 끝난 뒤 제한된 SSH 명령만 실행한다.

```text
deploy-frontend <12자리 Git SHA>
```

Server A는 ECR Pull 전용 자격증명으로 image를 내려받고 Health Check를 수행한다. 새 컨테이너가 정상 상태가 되지 않으면 이전 Frontend image로 복구한다.
