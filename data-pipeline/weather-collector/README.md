# 기상청 실시간 날씨 수집기

대전 대표 격자의 기상청 초단기실황 `T1H`(기온, °C)와 `RN1`(1시간 강수, mm)을 수집한다. API는 기상청 단기예보 조회서비스의 `getUltraSrtNcst`를 사용한다.

이 프로그램은 **원본 관측 수집과 보존만 담당**한다. 피처 계약의 발표 지연 정렬(`t >= H:40`이면 `obs(H)`, 아니면 `obs(H-1)`), 최대 3시간 ffill, `minutes_since_rain` 계산은 Spark/AI 공용 피처 코드에서 수행한다.

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
