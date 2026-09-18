# 타슈 실시간 수집기

## 역할

대전 타슈 전체 대여소의 실시간 상태를 기본 45초 간격으로 수집합니다. 한 snapshot은 대전 전체 대여소 상태이며, 현재 약 1,370개 대여소라 일반적으로 snapshot당 API 요청 2회가 필요합니다. page 1의 `totalCount`를 기준으로 모든 페이지를 받은 뒤 중복과 개수를 검증한 완전한 snapshot만 저장 buffer에 넣습니다.

운영 원본(Source of Truth)은 Parquet입니다. CSV는 로컬 확인이 필요할 때만 선택적으로 생성합니다.

Kafka를 활성화하면 같은 수집 결과에 공통 `snapshot_id`를 부여하고 대여소별
event로 `tashu.station-availability.v1` topic에 발행합니다. Kafka는 실시간 전달
경로이며 Parquet/S3 원본 저장을 대체하지 않습니다.

Redis를 활성화하면 검증을 통과한 전체 snapshot을 JSON 하나로 원자적으로
`tashu:station-availability:latest:v1`에 저장합니다. `stations`의 각 항목에는
`station_id`, `bikes`, `collected_at`만 저장합니다. 키에는 TTL을 두므로 수집기가
멈췄을 때 오래된 값을 실시간 값처럼 계속 노출하지 않습니다.

## 환경변수

| 변수 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `TASHU_API_KEY` | 예 | 없음 | 공공데이터포털 API key |
| `TASHU_API_KEY_FALLBACK` | 아니요 | 없음 | primary key를 사용할 수 없을 때 쓸 예비 key |
| `TASHU_INTERVAL_SECONDS` | 아니요 | `45` | 수집 간격(초) |
| `TASHU_WRITE_CSV` | 아니요 | `false` | `true`이면 Parquet과 함께 CSV part 생성 |
| `TASHU_DATA_DIR` | 아니요 | `data` | snapshot과 state를 저장할 기준 디렉토리 |
| `TASHU_KAFKA_ENABLED` | 아니요 | `false` | `true`이면 Kafka outbox와 발행 활성화 |
| `TASHU_KAFKA_BOOTSTRAP_SERVERS` | 아니요 | `localhost:9092` | Kafka bootstrap server 목록 |
| `TASHU_KAFKA_TOPIC` | 아니요 | `tashu.station-availability.v1` | 대여소 상태 event topic |
| `TASHU_KAFKA_CLIENT_ID` | 아니요 | `tashu-collector` | Kafka producer client ID |
| `TASHU_KAFKA_DELIVERY_TIMEOUT_SECONDS` | 아니요 | `10` | snapshot 발행 완료 대기시간 |
| `TASHU_KAFKA_SPOOL_DIR` | 아니요 | `<data>/kafka-spool` | 미전송 snapshot outbox 디렉토리 |
| `TASHU_REDIS_ENABLED` | 아니요 | `false` | `true`이면 최신 완전 snapshot을 Redis에 반영 |
| `TASHU_REDIS_HOST` | 아니요 | `localhost` | Backend와 같은 Redis host |
| `TASHU_REDIS_PORT` | 아니요 | `6379` | Redis port |
| `TASHU_REDIS_DATABASE` | 아니요 | `0` | Backend와 같은 Redis 논리 DB index |
| `TASHU_REDIS_PASSWORD` | 아니요 | 없음 | Redis 인증 비밀번호(서버 Secret으로 주입) |
| `TASHU_REDIS_LATEST_KEY` | 아니요 | `tashu:station-availability:latest:v1` | 최신 snapshot key |
| `TASHU_REDIS_TTL_SECONDS` | 아니요 | `180` | 최신 snapshot TTL. 수집 간격보다 길게 설정 |
| `DISCORD_WEBHOOK_URL` | 아니요 | 없음 | 시작, 종료, 장애 및 일일 요약 알림 |
| `LOG_LEVEL` | 아니요 | `INFO` | Python 로그 레벨 |

`.env.example`은 변수 목록을 보여주는 예시일 뿐이며, 프로그램이 `.env`를 자동 로드하지는 않습니다. 서버 환경변수나 별도 secret 관리 기능으로 값을 주입하세요.

## 설치

Linux/macOS:

```bash
cd data-pipeline/collector
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Windows PowerShell:

```powershell
cd data-pipeline/collector
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
```

## 실행

Linux/macOS 예시:

```bash
export TASHU_API_KEY='서버의-secret-값'
python collect.py
```

Windows PowerShell 예시:

```powershell
$env:TASHU_API_KEY = '로컬-secret-값'
py collect.py
```

실제 API와 Kafka를 처음 함께 확인할 때는 계속 실행하기 전에 한 번만 수집하는
옵션을 사용합니다.

```powershell
$env:TASHU_API_KEY = '로컬-secret-값'
$env:TASHU_KAFKA_ENABLED = 'true'
$env:TASHU_KAFKA_BOOTSTRAP_SERVERS = 'localhost:9092'
$env:TASHU_REDIS_ENABLED = 'true'
python collect.py --once
```

`--once`는 완전한 snapshot 하나만 수집하여 Parquet 저장과 Kafka 발행을 마친 뒤
종료합니다. API key는 PowerShell 환경변수로만 주입하고 파일이나 Git에 저장하지
않습니다.

Redis 반영은 key 존재 여부와 TTL로 확인할 수 있습니다. 인증이 설정된 운영 서버에서는
비밀번호를 명령행 인자로 남기지 말고 `REDISCLI_AUTH` 같은 안전한 주입 방식을 사용하세요.

```bash
redis-cli -n 0 EXISTS tashu:station-availability:latest:v1
redis-cli -n 0 TTL tashu:station-availability:latest:v1
```

저장 값의 형태는 다음과 같습니다.

```json
{
  "schema_version": 1,
  "snapshot_id": "...",
  "station_count": 1,
  "stations": [
    {
      "station_id": "ST0001",
      "bikes": 7,
      "collected_at": "2026-09-18T10:00:00+09:00"
    }
  ]
}
```

기본 45초 간격이면 하루 약 1,920 snapshot, 대전 대여소가 두 페이지일 때 기본 약 3,840 API 요청을 사용합니다. 재시도 횟수에 따라 실제 호출량은 늘어날 수 있으며 key별 KST 일일 상한은 4,500회입니다.

## 테스트

collector 디렉토리에서 실행합니다.

```bash
python -m unittest discover tests
```

Windows/Windows PowerShell에서 `python` 명령이 없다면 `py -m unittest discover tests`를 사용합니다. 테스트는 실제 API를 호출하지 않습니다.

현재 고정된 의존성 버전은 Windows의 Python 3.12 환경에서 검증했습니다.

로컬 Kafka가 `localhost:9092`에서 실행 중이고 topic이 준비된 뒤에는 실제
API key 없이 다음 smoke test로 두 개의 대여소 event를 발행할 수 있습니다.

```powershell
python smoke_kafka.py
```

성공하면 `messages=2 pending=0`이 출력됩니다. Kafka가 중지된 상태에서 실행하면
전송 오류가 발생하지만 `data/kafka-smoke-spool`의 batch는 삭제되지 않으며,
Kafka를 다시 시작하고 같은 명령을 실행하면 이전 batch부터 replay됩니다.

## 저장 위치

`TASHU_DATA_DIR`의 기본값은 collector 실행 위치 기준 `data`입니다.

```text
data/
├─ snapshots/
│  └─ dt=YYYY-MM-DD/
│     └─ snapshots-HHMMSS-<uuid>.parquet
├─ csv/                         # TASHU_WRITE_CSV=true일 때만
│  └─ dt=YYYY-MM-DD/
│     └─ snapshots-HHMMSS-<uuid>.csv
├─ state/
│  └─ collector_state.json      # key 이름별 호출량과 일일 통계
└─ kafka-spool/                 # Kafka 활성화 시 미전송 snapshot batch
health.json                     # 마지막 정상 수집 시각과 대여소 수
```

Kafka를 활성화한 경우 Collector는 각 snapshot의 event batch를 먼저
`kafka-spool`에 atomic save한 뒤 오래된 파일부터 발행합니다. 모든 event의
delivery 확인이 끝난 snapshot만 spool에서 제거합니다. 전송 도중 장애가 나면
파일을 유지하고 다음 수집 또는 재시작 시 동일한 `event_id`로 replay합니다.
따라서 consumer는 `event_id` 기준 중복 제거가 가능해야 합니다.

Parquet과 선택적 CSV는 약 5분마다 immutable part로 atomic save됩니다. 강제 종료 신호(SIGTERM/SIGINT)를 받으면 현재 동작을 마친 뒤 남은 buffer를 flush합니다. `health.json` 기본 위치는 collector의 현재 실행 디렉토리이며 `TASHU_HEALTH_PATH`로 별도 지정할 수도 있습니다.

## 주의

- 실제 API key와 webhook URL을 코드, 로그, Git에 넣지 마세요.
- Collector와 Backend의 Redis host, database index, key가 같아야 합니다. staging(DB 1)과 production(DB 0)은 각 환경의 Backend에 맞춰 별도로 지정하세요.
- 실제 운영 Parquet, CSV, `collector_state.json`, `health.json`, 로그를 commit하지 마세요.
- `.env.example`에는 실제 key를 넣지 마세요.
- snapshot 검증에 실패하면 해당 snapshot 전체를 버리고 다시 수집하므로 일부 페이지만 저장되지 않습니다.
