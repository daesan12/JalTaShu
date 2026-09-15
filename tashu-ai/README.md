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

# 테스트
.venv/Scripts/python -m pytest tests/ -q
```

산출물은 `artifacts/` (git 미추적): `trips/trips_YYYY-MM.parquet`, `reports/preprocess_report.txt`, `reports/monthly_histogram.csv`.
