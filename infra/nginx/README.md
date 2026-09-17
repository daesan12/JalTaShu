# Server A Nginx staging gateway

Server A의 공개 HTTP 요청을 loopback에만 열린 Frontend·Backend staging 컨테이너로 전달한다.

## 파일 역할

| 파일 | 역할 | Secret |
| --- | --- | --- |
| `tashu.conf` | 공개 경로를 Frontend·Backend staging으로 전달하는 Nginx server block | 없음 |

## 경로 계약

| 브라우저 경로 | 내부 대상 | 설명 |
| --- | --- | --- |
| `/staging/` | `127.0.0.1:18080/` | React 정적 파일과 SPA fallback |
| `/staging-api/` | `127.0.0.1:18081/api/` | 일반 Backend API |
| `/staging-auth/` | `127.0.0.1:18081/api/auth/` | Frontend가 시작하는 OAuth 로그인 |
| `/api/auth/oauth/callback/` | `127.0.0.1:18081/api/auth/oauth/callback/` | 현재 Backend가 생성하는 OAuth callback |
| `/health` | Nginx 자체 응답 | 공개 진입점 상태 확인 |

`proxy_pass` 뒤의 `/`로 외부 staging prefix를 제거한다. 예를 들어 `/staging-api/users/me`는 Backend의 `/api/users/me`로 전달된다.

Backend의 사용자·관리자 refresh cookie Path는 각각 `/api/auth`, `/api/admin`이다. 브라우저가 staging의
`/staging-api/auth`, `/staging-api/admin` 요청에 쿠키를 보내도록 `proxy_cookie_path`로 두 경로를 맞춘다.

## 현재 OAuth 계약

Backend 설정은 callback을 `{baseUrl}/api/auth/oauth/callback/{registrationId}`로 생성한다. 따라서 Nginx는 해당 callback 경로를 별도로 전달한다. Kakao 개발자 콘솔에는 외부에서 실제로 사용하는 다음 URI를 등록해야 한다.

```text
https://j15b103.p.ssafy.io/api/auth/oauth/callback/kakao
```

Backend staging은 `JWT_SECURE=true`와 HTTPS Frontend 성공·실패 URL을 사용한다. Backend가 callback을 `/staging-auth/oauth/callback/kakao`로 직접 생성하도록 계약을 바꾸는 경우 이 설정도 함께 수정한다.

## 설치 전 검증

```bash
docker run --rm \
  --network host \
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
curl --fail https://j15b103.p.ssafy.io/staging/
curl --fail https://j15b103.p.ssafy.io/staging-api/actuator/health
curl --head https://j15b103.p.ssafy.io/staging-auth/oauth/kakao
sudo ss -lntp
sudo ufw status
```

## 되돌리기

설치 전에 `/etc/nginx`를 백업한다. 문제가 생기면 새 site를 비활성화하고 백업한 설정을 복원한 뒤 `nginx -t`가 통과한 경우에만 reload한다. 외부 접근을 즉시 닫으려면 `sudo ufw delete allow 443/tcp`와 `sudo ufw delete allow 80/tcp`를 사용한다.

## 아직 필요한 팀 확인

- Jira 81: Kakao 개발자 콘솔에 현재 HTTPS callback URI 등록 확인
- Jira 51: Naver Maps Client ID와 staging 허용 도메인
