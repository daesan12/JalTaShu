# Frontend runtime image

React/Vite 결과물을 빌드한 뒤 외부 Nginx가 프록시할 수 있는 내부 HTTP 서버로 제공한다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `Dockerfile` | Node 22에서 React를 빌드하고 결과물만 non-root Nginx image에 복사한다. |
| `default.conf` | 8080 포트, `/health`, React Router용 SPA fallback을 정의한다. |

## staging build contract

```text
VITE_API_BASE_URL=/staging-api
VITE_AUTH_BASE_URL=/staging-auth
VITE_BASE_PATH=/staging/
VITE_ENABLE_MSW=false
```

Jenkins가 저장소 루트를 Docker build context로 사용한다. 루트 `.dockerignore`는 build에 `frontend/`와 이 디렉터리만 전달해 다른 서비스 파일과 Secret이 이미지에 섞이는 것을 막는다.

이 컨테이너는 API reverse proxy와 공개 TLS를 담당하지 않는다. Server A의 외부 Nginx가 `/staging/` 요청의 prefix를 제거해 이 컨테이너의 8080 포트로 전달한다.
