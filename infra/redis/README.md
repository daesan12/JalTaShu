# Redis runtime

Server A에서 Backend의 Refresh Token, 실시간 대여소·날씨 상태와 AI 예측 캐시를 저장할 Redis 한 개를 실행한다. Backend는 기존 Docker network `tashu-app`으로 접근하고, Server A의 Collector와 Server B의 AI 서비스는 Server A 사설 주소로만 접근한다. 새 Redis instance를 추가하지 않는다.

## 파일 역할

| 경로 | 역할 | Git/Secret |
| --- | --- | --- |
| `compose.yml` | Redis image, AOF 영속화, health check, 자원 제한과 내부 network 정의 | Git 추적, Secret 없음 |
| `scripts/generate-secret.sh` | 64자리 임의 비밀번호를 서버 전용 환경파일에 최초 한 번 생성 | Git 추적, Secret 없음 |
| `/etc/tashu/redis/runtime.env` | 실제 `REDIS_PASSWORD` 저장 | Server A 전용, Git 금지, `0600 root:root` |
| `/opt/tashu/infra/redis/.env` | `REDIS_PRIVATE_BIND_ADDRESS` 저장 | 서버별 비밀이 아닌 설정, Git 금지 |
| Docker volume `tashu-redis-data` | Refresh Token 등 Redis 데이터를 AOF로 보존 | Server A 전용 데이터 |

## 구조

```text
Backend staging/production ── Docker network: tashu-app ─┐
                                                         ▼
Server B AI serving ── private network + UFW ──> tashu-redis:6379
                                                         │
                                                         ▼
                                           tashu-redis-data volume
```

현재 한 Redis instance를 사용하되 용도별로 database index를 나눈다. Blue/Green production 컨테이너는 동일한 production Redis 논리 DB를 바라봐야 배포 전환 중 로그인 상태가 유지된다.

| DB | 용도 |
| --- | --- |
| `0` | production 인증 데이터와 Collector가 발행하는 실시간 대여소·날씨 키 |
| `1` | staging 인증 데이터 |
| `2` | AI가 발행하는 `pred:*` 예측 키 |

staging Backend는 일반 인증 연결에는 DB 1을 사용하지만, `stationRealtimeRedisTemplate`에는 DB 0을 명시해 production과 같은 실시간 대여소·날씨 키를 읽는다.

## Server A 적용

```bash
cd /opt/tashu/infra/redis
sudo ./scripts/generate-secret.sh
printf 'REDIS_PRIVATE_BIND_ADDRESS=%s\n' '<SERVER_A_PRIVATE_IP>' | sudo tee .env >/dev/null
sudo chmod 0644 .env
sudo docker compose config --quiet
sudo docker compose up -d
```

`generate-secret.sh`는 파일이 이미 있으면 값을 바꾸지 않는다. 비밀번호를 예고 없이 변경하면 실행 중인 Backend가 Redis에 접속하지 못하므로 자동 회전하지 않는다.

## 검증

```bash
sudo docker compose ps
sudo docker inspect --format '{{.State.Health.Status}}' tashu-redis
sudo ss -lntp | grep '<SERVER_A_PRIVATE_IP>:6379 '
sudo docker network inspect tashu-app --format '{{range .Containers}}{{.Name}} {{end}}'
```

정상 상태는 `tashu-redis`가 `healthy`이고, `6379`가 Server A 사설 주소에만 listen하며, UFW가 Server B 사설 주소만 허용하는 것이다. 공인 주소와 `0.0.0.0`에는 bind하지 않는다.

## Backend 연결 계약

Backend 컨테이너에는 다음 Spring 환경변수를 주입한다.

```text
SPRING_DATA_REDIS_HOST=tashu-redis
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=<서버 Secret에서 주입>
SPRING_DATA_REDIS_DATABASE=1   # staging
SPRING_DATA_REDIS_DATABASE=0   # production
```

staging의 실시간 데이터 전용 연결에는 다음 값을 별도로 주입한다. 비밀번호는 같은 Redis Secret에서 읽는다.

```text
TASHU_STATION_REDIS_HOST=tashu-redis
TASHU_STATION_REDIS_PORT=6379
TASHU_STATION_REDIS_PASSWORD=<서버 Secret에서 주입>
TASHU_STATION_REDIS_DATABASE=0
```

대여소 Collector와 날씨 Collector도 DB 0을 사용한다. 두 Collector는 호스트에서 실행되므로 Docker DNS 이름 대신 Server A 사설 주소로 Redis에 접속한다. 날씨 Redis 발행 코드는 데이터 파트 구현·병합 후 활성화한다.

## AI 연결 계약

AI 서빙은 같은 Redis의 논리 DB 2를 사용한다. 접속정보는 Server B의 `/etc/tashu/ai-serving/redis.env`에 `0600 root:root`로 저장한다.

```text
TASHU_AI_REDIS_HOST=<SERVER_A_PRIVATE_IP>
TASHU_AI_REDIS_PORT=6379
TASHU_AI_REDIS_DB=2
TASHU_AI_REDIS_PASSWORD=<Server A Redis와 동일한 Secret>
```

Redis 6379는 Server B 사설 IP에서 Server A 사설 IP로 들어오는 연결만 UFW에서 허용한다.

`application.properties`의 `localhost` 값은 로컬 개발 기본값으로 유지하고, 배포 환경에서 위 환경변수로 덮어쓴다.

## 중지와 복구

```bash
sudo docker compose stop
sudo docker compose start
```

컨테이너를 다시 만들어도 `tashu-redis-data` volume은 유지한다. `docker compose down -v`는 Refresh Token 데이터를 삭제하므로 일반 운영 중에는 사용하지 않는다.
