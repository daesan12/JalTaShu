# Redis runtime

Server A에서 Backend의 Refresh Token 저장소로 사용할 Redis 한 개를 실행한다. Redis는 호스트 포트를 publish하지 않고 기존 외부 Docker network `tashu-app`에만 연결한다.

## 파일 역할

| 경로 | 역할 | Git/Secret |
| --- | --- | --- |
| `compose.yml` | Redis image, AOF 영속화, health check, 자원 제한과 내부 network 정의 | Git 추적, Secret 없음 |
| `scripts/generate-secret.sh` | 64자리 임의 비밀번호를 서버 전용 환경파일에 최초 한 번 생성 | Git 추적, Secret 없음 |
| `/etc/tashu/redis/runtime.env` | 실제 `REDIS_PASSWORD` 저장 | Server A 전용, Git 금지, `0600 root:root` |
| Docker volume `tashu-redis-data` | Refresh Token 등 Redis 데이터를 AOF로 보존 | Server A 전용 데이터 |

## 구조

```text
Backend staging/production
          │ Docker network: tashu-app
          ▼
     tashu-redis:6379
          │
          ▼
 Docker volume: tashu-redis-data
```

현재 한 Redis instance를 사용하되 staging과 production Backend에는 서로 다른 database index를 주입한다. Blue/Green production 컨테이너는 동일한 production Redis 논리 DB를 바라봐야 배포 전환 중 로그인 상태가 유지된다.

## Server A 적용

```bash
cd /opt/tashu/infra/redis
sudo ./scripts/generate-secret.sh
sudo docker compose config --quiet
sudo docker compose up -d
```

`generate-secret.sh`는 파일이 이미 있으면 값을 바꾸지 않는다. 비밀번호를 예고 없이 변경하면 실행 중인 Backend가 Redis에 접속하지 못하므로 자동 회전하지 않는다.

## 검증

```bash
sudo docker compose ps
sudo docker inspect --format '{{.State.Health.Status}}' tashu-redis
sudo ss -lntp | grep ':6379 ' || echo 'Redis host port not published'
sudo docker network inspect tashu-app --format '{{range .Containers}}{{.Name}} {{end}}'
```

정상 상태는 `tashu-redis`가 `healthy`이고, 호스트의 `6379` listen 결과가 없으며, `tashu-app` network에 `tashu-redis`가 표시되는 것이다.

## Backend 연결 계약

Backend 컨테이너에는 다음 Spring 환경변수를 주입한다.

```text
SPRING_DATA_REDIS_HOST=tashu-redis
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=<서버 Secret에서 주입>
SPRING_DATA_REDIS_DATABASE=1   # staging
SPRING_DATA_REDIS_DATABASE=0   # production
```

`application.properties`의 `localhost` 값은 로컬 개발 기본값으로 유지하고, 배포 환경에서 위 환경변수로 덮어쓴다.

## 중지와 복구

```bash
sudo docker compose stop
sudo docker compose start
```

컨테이너를 다시 만들어도 `tashu-redis-data` volume은 유지한다. `docker compose down -v`는 Refresh Token 데이터를 삭제하므로 일반 운영 중에는 사용하지 않는다.
