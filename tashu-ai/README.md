# tashu-ai — 대여소 예측 모델·서빙

문서: [docs/AI_구현_가이드.md](../docs/AI_구현_가이드.md) · [docs/피처_스키마_계약.md](../docs/피처_스키마_계약.md) · [docs/AI_설계서.md](../docs/AI_설계서.md)

## 설정

```bash
cd tashu-ai
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

원본 CSV 위치는 [config.py](config.py)의 `DATA_ROOT` (기본: `C:\Users\SSAFY\Desktop\타슈 데이터`).

## 실행 (단계별)

```bash
# 1단계: 전처리 — 월별 Parquet + 히스토그램/dedupe 리포트
.venv/Scripts/python -m src.preprocess

# 2단계: 15분 버킷 집계 — 마스크·운영 구간 0-fill (1단계 산출물 필요)
.venv/Scripts/python -m src.buckets

# 3단계: station_profile 생성 — 학습 구간 한정 (2단계 산출물 필요)
.venv/Scripts/python -m src.profile
# features.py는 실행 파일이 아니라 학습·서빙 공용 모듈 (train.py/serve.py가 import)

# 5단계: 학습 (Spark train_buckets 필요, ~30분) → artifacts/models/lgbm_{lambda,mu}.joblib
.venv/Scripts/python -m src.train

# 테스트
.venv/Scripts/python -m pytest tests/ -q
```

산출물은 `artifacts/` (git 미추적): `trips/trips_YYYY-MM.parquet`, `reports/preprocess_report.txt`, `reports/monthly_histogram.csv`.

## 서빙 (7단계 `src/serve.py` — 매분 배치 → Redis)

모델 3파일(`lgbm_lambda.joblib`, `lgbm_mu.joblib`, `station_profile.parquet`)을 `artifacts/models/`에 두고 실행한다.
접속 정보는 환경변수만 사용한다 — 이름은 [config.py](config.py) `DB_ENV`·`REDIS_ENV` (운영은 인프라가 Secret으로 주입).

```bash
# 기본: 60초 주기 루프 (컨테이너용). --once: 1회 실행 후 종료
.venv/Scripts/python -m src.serve --env-file dev/.env
.venv/Scripts/python -m src.serve --env-file dev/.env --once
```

가동 점검(데이터 담당 활성화 조건) 중 하나라도 실패하면 Redis에 쓰지 않고 `미가동 — …` 경고만 남긴다:
최신 collected_at 2분 이내 / 스냅샷 이력 60분+ / 날씨 이력 24시간+ / 완전 snapshot(`COUNT(*) = station_count`)만 사용.
낡은 키는 TTL(180초)로 자연 소멸하므로 백엔드는 키 부재 = "예측 없음"으로 처리한다.

## 캘리브레이션·백테스트 (9·10단계 — 스냅샷 홀드아웃)

S3 `bronze/realtime/`(수집기 스냅샷·날씨 Parquet)을 **파이썬이 직접 읽지 않고** `aws s3 sync`로 로컬에 내려받아 쓴다.
자격증명은 사용자 PC의 aws profile에만 둔다 (코드·저장소·채팅 금지). 대상 폴더는 [config.py](config.py) `S3_LOCAL_ROOT`.

```bash
# 1) 내려받기 (날짜 범위만큼 반복 실행하면 새 날짜가 추가됨)
aws s3 sync s3://s15p21b103-tashu-datalake/bronze/realtime/snapshots/ "C:/Users/SSAFY/Desktop/타슈 데이터/s3/realtime/snapshots/" --profile tashu-ai
aws s3 sync s3://s15p21b103-tashu-datalake/bronze/realtime/weather/observations/ "C:/Users/SSAFY/Desktop/타슈 데이터/s3/realtime/weather/observations/" --profile tashu-ai

# 2) 리플레이: 시점마다 서빙과 같은 코드로 예측 → t+h 실제와 짝 (start 00:00 ~ end 00:00 직전, 기본 5분 간격)
.venv/Scripts/python -m src.replay --start 2026-09-10 --end 2026-09-17

# 3) 캘리브레이션: Brier · PR-AUC · 곡선 · tail_correction (모델 vs 베이스라인 2종, 콜드스타트 분리)
.venv/Scripts/python -m src.calibrate --start 2026-09-10 --end 2026-09-17

# 4) 백테스트: 현재 잔여 기준 추천 vs AI 추천 → 헛걸음 감소율 (발표 수치)
.venv/Scripts/python -m src.backtest --start 2026-09-10 --end 2026-09-17

# 5) FE·BE 연결용 예측 JSON (Redis에서, 또는 리플레이 시점에서)
.venv/Scripts/python -m dev.export_predictions --env-file dev/.env --from-redis --out artifacts/predictions_sample.json
.venv/Scripts/python -m dev.export_predictions --from-replay "2026-09-11 08:10" --start 2026-09-10 --end 2026-09-17
```

산출물: `artifacts/replay/replay_<기간>.parquet`(예측 vs 실제), `artifacts/reports/calibration_*_<기간>.*`, `backtest_*_<기간>.*`.
리포트에는 기간·표본 수·고갈 건수를 항상 함께 적는다 — 1주치 1차 결과는 발표 전 재실행으로 갱신한다.

평가 규칙 (실데이터 1차 실행에서 확정, 2026-09-17):

- **결정 구간 분리** — 어느 시점에나 대여소 절반 가까이가 잔여 0이고, s=0 행은 모델·베이스라인 셋 모두 계약상 확률 1로 같다.
  캘리브레이션 리포트는 전체 지표와 함께 **현재 잔여 ≥1(`has_bike_now`)** 구간을 따로 보고한다 — 예측이 결정을 바꾸는 구간은 여기다.
- **백테스트 정책 B의 선택지 = A와 같은 '현재 잔여 ≥1' 후보** — 빈 출발지(도보 1분·확률 1 → 비용 9분)를 허용하면 8분 넘게 떨어진
  잔여 대여소를 이겨 빈 곳을 추천한다(결정의 0.8%지만 98%가 헛걸음). 앱 추천 후보도 잔여 있는 곳이므로 제외.
- **보정계수 단일값 1.25 서빙 적용** (`config.TAIL_CORRECTION`) — 결정 구간 Brier 최소가 지평별 1.35/1.25/1.20으로 1주치 잡음 범위라 중앙값 하나. 리플레이의 모델·프로파일 베이스라인 확률에도 같은 계수를 적용하고, 캘리브레이션의 격자 탐색은 원시 λ·μ·s로 다시 계산한다.
- S3 스냅샷 Parquet은 ns, 날씨는 us 단위로 저장돼 있어 로더가 서빙과 같은 us로 맞춘다 (`snapshots.TIME_UNIT`). 단위가 다르면 `merge_asof`가 거부한다.

### 로컬 검증 (실 MySQL은 방화벽으로 개발 PC 접속 불가)

```bash
cp dev/.env.example dev/.env
docker compose -f dev/compose.yml up -d          # MySQL(3307, 운영 DDL 적용) + Redis(6380)
.venv/Scripts/python -m dev.seed_snapshots --env-file dev/.env   # 가짜 스냅샷 70분 + 날씨 26시간
.venv/Scripts/python -m src.serve --env-file dev/.env --once
docker compose -f dev/compose.yml exec redis redis-cli --scan --pattern "pred:*" | head
docker compose -f dev/compose.yml exec redis redis-cli TTL pred:ST0001:15
```
