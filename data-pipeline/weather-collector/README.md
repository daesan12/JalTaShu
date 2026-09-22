# 기상청 실시간 날씨 수집기

대전 대표 격자의 기상청 초단기실황 `T1H`(기온, °C)와 `RN1`(1시간 강수, mm)을 수집한다. API는 기상청 단기예보 조회서비스의 `getUltraSrtNcst`를 사용한다.

이 프로그램은 원본 관측을 보존하고, 선택적으로 정규화된 새 관측을 Kafka `tashu.weather-observation.v1`에 발행한다. 피처 계약의 발표 지연 정렬(`t >= H:40`이면 `obs(H)`, 아니면 `obs(H-1)`), 최대 3시간 ffill, `minutes_since_rain` 계산은 AI 공용 피처 코드에서 수행한다.

## 실행

실제 인증키는 파일이나 Git에 저장하지 않고 서버 환경변수로 주입한다.

```powershell
$env:KMA_API_KEY = '공공데이터포털-key'
python collect.py --once
```

계속 실행하려면 `--once`를 뺀다. 기본 5분마다 확인하며, 같은 관측시각은 새 Parquet을 만들지 않고 `latest.json`과 health만 갱신한다.

## 환경변수

| 변수 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `KMA_API_KEY` | 예 | 없음 | 공공데이터포털 인증키 |
| `KMA_NX` | 아니요 | `67` | 기상청 격자 X |
| `KMA_NY` | 아니요 | `100` | 기상청 격자 Y |
| `WEATHER_INTERVAL_SECONDS` | 아니요 | `300` | API 확인 간격 |
| `WEATHER_RELEASE_MINUTE` | 아니요 | `40` | 현재 정시 관측이 사용 가능해지는 분 |
| `WEATHER_DATA_DIR` | 아니요 | `data` | 데이터 기준 디렉터리 |
| `WEATHER_HEALTH_PATH` | 아니요 | `health.json` | 최근 성공 상태 파일 |
| `WEATHER_KAFKA_ENABLED` | 아니요 | `false` | `true`이면 Kafka outbox와 발행 활성화 |
| `WEATHER_KAFKA_BOOTSTRAP_SERVERS` | 아니요 | `localhost:9092` | Kafka bootstrap server 목록 |
| `WEATHER_KAFKA_TOPIC` | 아니요 | `tashu.weather-observation.v1` | 날씨 관측 topic |
| `WEATHER_KAFKA_CLIENT_ID` | 아니요 | `tashu-weather-collector` | Kafka producer client ID |
| `WEATHER_KAFKA_DELIVERY_TIMEOUT_SECONDS` | 아니요 | `10` | 전송 완료 대기시간 |
| `WEATHER_KAFKA_SPOOL_DIR` | 아니요 | `<data>/kafka-spool` | 미전송 관측 outbox 디렉터리 |
| `WEATHER_REDIS_ENABLED` | 아니요 | `false` | `true`이면 최신 날씨 Redis 저장 활성화 |
| `WEATHER_REDIS_HOST` | 아니요 | `localhost` | 대여소 수집기와 동일한 Redis host |
| `WEATHER_REDIS_PORT` | 아니요 | `6379` | 대여소 수집기와 동일한 Redis port |
| `WEATHER_REDIS_DATABASE` | 아니요 | `0` | 대여소 실시간 snapshot과 동일한 논리 DB |
| `WEATHER_REDIS_PASSWORD` | 아니요 | 없음 | 서버 환경파일에서 주입하는 Redis 비밀번호 |
| `WEATHER_REDIS_LATEST_KEY` | 아니요 | `tashu:weather:latest:v1` | 최신 날씨 String 키 |
| `WEATHER_REDIS_TTL_SECONDS` | 아니요 | `3600` | 최신 날씨 키 TTL(초) |

`67,100`은 대전 대표 격자 기본값이다. 운영 배포 전 과거 Open-Meteo 학습에 사용한 대표 위치와 같은 생활권인지 AI 담당자와 최종 확인한다.

## 저장 구조

```text
data/
├─ observations/
│  └─ dt=YYYY-MM-DD/
│     └─ weather-HHMM-nx67-ny100.parquet
└─ latest.json
health.json
```

Kafka를 활성화하면 새 Parquet이 생성되는 관측만 먼저 outbox에 저장한 뒤 발행한다.
전송에 실패한 파일은 삭제하지 않고 다음 수집 주기에 오래된 순서로 재전송한다.
메시지 key는 `nx:ny`, 중복 제거용 `event_id`는
`observed_at:nx:ny`이며 API key는 메시지에 포함하지 않는다.

Redis를 활성화하면 기상청 수집에 성공할 때마다 최신 관측을
`tashu:weather:latest:v1`에 String JSON으로 저장하고 TTL을 갱신한다.
같은 관측시각이라 새 Parquet이 생성되지 않아도 다시 저장한다. Redis 저장 실패는
로그로 남기되 Parquet 저장, Kafka 발행, health 갱신을 중단시키지 않는다.

운영 예시:

```bash
export WEATHER_KAFKA_ENABLED=true
export WEATHER_KAFKA_BOOTSTRAP_SERVERS=172.26.4.110:9092
export WEATHER_KAFKA_TOPIC=tashu.weather-observation.v1
python collect.py --once
```

Parquet 스키마:

```text
observed_at, fetched_at, nx, ny,
temperature, rainfall_1h, source
```

- `observed_at`: 기상청 관측 기준시각(KST)
- `fetched_at`: Collector가 실제로 받은 시각(KST)
- 같은 시간·격자의 파일명은 하나뿐이므로 반복 호출에도 중복 적재되지 않는다.
- 다음 단계에서는 append-only `observations`를 Spark로 읽고, 실제 예측시각에 이용 가능했던 관측만 선택한다.

## 테스트

```bash
python -m unittest discover -s tests -v
```

테스트는 실제 API를 호출하지 않는다.
