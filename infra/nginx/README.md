# Server A Nginx gateway

Server A의 공개 HTTP 요청을 loopback에만 열린 staging과 production 컨테이너로 전달한다.
production은 Blue·Green 중 활성 slot 하나만 바라본다.

## 파일 역할

| 파일 | 역할 | Secret |
| --- | --- | --- |
| `tashu.conf` | staging 고정 경로와 production 활성 upstream을 정의하는 Nginx server block | 없음 |
| `/etc/nginx/tashu-production-frontend-upstream.conf` | 현재 production Frontend slot의 loopback 주소 한 줄 | 서버 상태 파일, Secret 없음 |
| `/etc/nginx/tashu-production-backend-upstream.conf` | 현재 production Backend slot의 loopback 주소 한 줄 | 서버 상태 파일, Secret 없음 |

## 경로 계약

| 브라우저 경로 | 내부 대상 | 설명 |
| --- | --- | --- |
| `/staging/` | `127.0.0.1:18080/` | React 정적 파일과 SPA fallback |
| `/staging-api/` | `127.0.0.1:18081/api/` | 일반 Backend API |
| `/staging-auth/` | `127.0.0.1:18081/api/auth/` | Frontend가 시작하는 OAuth 로그인 |
| `/api/auth/oauth/callback/` | `127.0.0.1:18081/api/auth/oauth/callback/` | 기존 staging OAuth callback |
| `/production-oauth-callback/` | 활성 production Backend의 `/api/auth/oauth/callback/` | 운영 OAuth callback 전용 경로 |
| `/` | 활성 production Frontend (`28080` 또는 `28082`) | 운영 React 앱과 SPA fallback |
| `/api/` | 활성 production Backend (`28081` 또는 `28083`) | 운영 일반 API와 OAuth callback |
| `/auth/` | 활성 production Backend의 `/api/auth/` | 운영 Frontend가 시작하는 OAuth 로그인 |
| `/health` | Nginx 자체 응답 | 공개 진입점 상태 확인 |

`proxy_pass` 뒤의 `/`로 외부 staging prefix를 제거한다. 예를 들어 `/staging-api/users/me`는 Backend의 `/api/users/me`로 전달된다.

Backend의 사용자·관리자 refresh cookie Path는 각각 `/api/auth`, `/api/admin`이다.
브라우저가 `/staging-api/auth`, `/staging-api/admin` 요청에 쿠키를 보내도록
`proxy_cookie_path`로 staging 경로를 맞춘다.

## OAuth callback 분리

같은 도메인에서 staging과 production Backend를 함께 실행하므로 callback 경로를 분리한다.
기존 staging callback은 그대로 유지하고 production 환경파일만 별도 URI를 사용한다.
Kakao 개발자 콘솔에는 다음 두 URI를 모두 등록해야 한다.

```text
https://j15b103.p.ssafy.io/api/auth/oauth/callback/kakao
https://j15b103.p.ssafy.io/production-oauth-callback/kakao
```

staging 성공·실패 화면은 `/staging/`, `/staging/login`이고 production은 `/`, `/login`이다.
두 환경 모두 HTTPS이므로 `JWT_SECURE=true`를 사용한다.

## 설치 전 검증

```bash
docker run --rm \
  --network host \
  --volume "$PWD/test-production-frontend-upstream.conf:/etc/nginx/tashu-production-frontend-upstream.conf:ro" \
  --volume "$PWD/test-production-backend-upstream.conf:/etc/nginx/tashu-production-backend-upstream.conf:ro" \
  --volume "$PWD/tashu.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginxinc/nginx-unprivileged:1.28.0-alpine \
  nginx -t
```

## Server A 설치

Nginx package 설치 후 기본 site 대신 이 설정을 사용한다.

```bash
sudo install -o root -g root -m 0644 \
  tashu.conf /etc/nginx/sites-available/tashu.conf

sudo ln -sfn /etc/nginx/sites-available/tashu.conf \
  /etc/nginx/sites-enabled/tashu.conf

sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Let's Encrypt 인증서는 Certbot Nginx plugin으로 발급한다. 인증서와 개인키는 `/etc/letsencrypt`에만 저장하며 Git에 복사하지 않는다. UFW 80번은 ACME 갱신과 HTTPS redirect, 443번은 실제 암호화 요청에 사용한다.

## 확인

```bash
curl --fail https://j15b103.p.ssafy.io/health
curl --fail https://j15b103.p.ssafy.io/
curl --fail https://j15b103.p.ssafy.io/api/actuator/health
curl --fail https://j15b103.p.ssafy.io/staging/
curl --fail https://j15b103.p.ssafy.io/staging-api/actuator/health
curl --head https://j15b103.p.ssafy.io/staging-auth/oauth/kakao
sudo ss -lntp
sudo ufw status
```

## 되돌리기

Blue/Green 전환 스크립트는 site와 upstream 두 파일을 모두 임시 백업한다. 설정 검사나 reload가 실패하면 세 파일을 함께 직전 상태로 복구한다. 정상 전환 뒤 애플리케이션 검증이 실패하면 Jenkins가 이전 slot으로 다시 전환한다.

## 아직 필요한 팀 확인

- Kakao 개발자 콘솔에 staging callback URI 추가
- 첫 production 전환과 자동 롤백 실증
