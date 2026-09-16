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

### 로컬 검증 (실 MySQL은 방화벽으로 개발 PC 접속 불가)

```bash
cp dev/.env.example dev/.env
docker compose -f dev/compose.yml up -d          # MySQL(3307, 운영 DDL 적용) + Redis(6380)
.venv/Scripts/python -m dev.seed_snapshots --env-file dev/.env   # 가짜 스냅샷 70분 + 날씨 26시간
.venv/Scripts/python -m src.serve --env-file dev/.env --once
docker compose -f dev/compose.yml exec redis redis-cli --scan --pattern "pred:*" | head
docker compose -f dev/compose.yml exec redis redis-cli TTL pred:ST0001:15
```
