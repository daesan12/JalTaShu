# 타슈 실시간 수집기

## 역할

대전 타슈 전체 대여소의 실시간 상태를 기본 45초 간격으로 수집합니다. 한 snapshot은 대전 전체 대여소 상태이며, 현재 약 1,370개 대여소라 일반적으로 snapshot당 API 요청 2회가 필요합니다. page 1의 `totalCount`를 기준으로 모든 페이지를 받은 뒤 중복과 개수를 검증한 완전한 snapshot만 저장 buffer에 넣습니다.

운영 원본(Source of Truth)은 Parquet입니다. CSV는 로컬 확인이 필요할 때만 선택적으로 생성합니다.

## 환경변수

| 변수 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `TASHU_API_KEY` | 예 | 없음 | 공공데이터포털 API key |
| `TASHU_API_KEY_FALLBACK` | 아니요 | 없음 | primary key를 사용할 수 없을 때 쓸 예비 key |
| `TASHU_INTERVAL_SECONDS` | 아니요 | `45` | 수집 간격(초) |
| `TASHU_WRITE_CSV` | 아니요 | `false` | `true`이면 Parquet과 함께 CSV part 생성 |
| `TASHU_DATA_DIR` | 아니요 | `data` | snapshot과 state를 저장할 기준 디렉토리 |
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

기본 45초 간격이면 하루 약 1,920 snapshot, 대전 대여소가 두 페이지일 때 기본 약 3,840 API 요청을 사용합니다. 재시도 횟수에 따라 실제 호출량은 늘어날 수 있으며 key별 KST 일일 상한은 4,500회입니다.

## 테스트

collector 디렉토리에서 실행합니다.

```bash
python -m unittest discover tests
```

Windows/Windows PowerShell에서 `python` 명령이 없다면 `py -m unittest discover tests`를 사용합니다. 테스트는 실제 API를 호출하지 않습니다.

현재 고정된 의존성 버전은 Windows의 Python 3.12 환경에서 검증했습니다.

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
└─ state/
   └─ collector_state.json      # key 이름별 호출량과 일일 통계
health.json                     # 마지막 정상 수집 시각과 대여소 수
```

Parquet과 선택적 CSV는 약 5분마다 immutable part로 atomic save됩니다. 강제 종료 신호(SIGTERM/SIGINT)를 받으면 현재 동작을 마친 뒤 남은 buffer를 flush합니다. `health.json` 기본 위치는 collector의 현재 실행 디렉토리이며 `TASHU_HEALTH_PATH`로 별도 지정할 수도 있습니다.

## 주의

- 실제 API key와 webhook URL을 코드, 로그, Git에 넣지 마세요.
- 실제 운영 Parquet, CSV, `collector_state.json`, `health.json`, 로그를 commit하지 마세요.
- `.env.example`에는 실제 key를 넣지 마세요.
- snapshot 검증에 실패하면 해당 snapshot 전체를 버리고 다시 수집하므로 일부 페이지만 저장되지 않습니다.
