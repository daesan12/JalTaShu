# -*- coding: utf-8 -*-
"""타슈 AI 파트 전역 설정 — 경로·분할 날짜·지평·임계값은 전부 여기서만 정의한다.

계약 문서: docs/피처_스키마_계약.md (이 파일의 값이 계약과 어긋나면 계약이 이긴다)
"""
from pathlib import Path

# ── 시간대 ──────────────────────────────────────────────────────────────
# 전 구간 Asia/Seoul aware. naive datetime·수동 +9h 금지 (CLAUDE.md 절대 규칙).
TZ = "Asia/Seoul"

# ── 경로 ────────────────────────────────────────────────────────────────
AI_ROOT = Path(__file__).resolve().parent
DATA_ROOT = Path(r"C:\Users\SSAFY\Desktop\타슈 데이터")  # 원본 대여이력 CSV 루트 (하위 폴더 재귀 탐색)
SPARK_DIR = DATA_ROOT / "spark"                          # 데이터 담당(Spark) 산출물 — train_buckets 등. 전처리 탐색에서 제외
ARTIFACTS_DIR = AI_ROOT / "artifacts"                    # 단계별 Parquet 산출물 (git 미추적)
TRIPS_DIR = ARTIFACTS_DIR / "trips"                      # 1단계 산출: 월별 파티션 Parquet
REPORTS_DIR = ARTIFACTS_DIR / "reports"                  # 히스토그램·dedupe 리포트

# ── 학습/검증 분할 (계약 §7) ─────────────────────────────────────────────
SPLIT_DATE = "2026-01-01"  # KST. 학습: bucket_start < SPLIT_DATE / 검증: ≥ SPLIT_DATE. 랜덤 분할 금지.

# ── 버킷·지평 (계약 §3·§4) ──────────────────────────────────────────────
BUCKET_MINUTES = 15          # 반개구간 [start, end), floor(minute/15)
SLOTS_PER_DAY = 96           # 24h × 4
HORIZONS_MIN = (5, 10, 15)   # MVP 3개. 30분은 백테스트 후 결정 — 키 추가만으로 확장

# ── 피처 임계값 (계약 §2·§6) ─────────────────────────────────────────────
DELTA_WINDOWS_MIN = (30, 60)     # delta_30m / delta_60m — 직전 N분 순변화(반납−대여)
DELTA_REBALANCE_ABS = 20         # |delta| > 20 → 재배치 간주, NaN (학습·서빙 동일)
DELTA_WARMUP_MINUTES = 60        # 수집기 기동 후 첫 60분 delta NaN
RAIN_THRESHOLD_MMH = 1.0         # '비 옴' 기준: 시간당 1mm 이상
MINUTES_SINCE_RAIN_CAP = 1440    # 마지막 강수 후 경과 분 상한
WEATHER_FFILL_MAX_HOURS = 3      # 날씨 결측 ffill 한도, 초과는 NaN
WEATHER_PUBLISH_MINUTE = 40      # 발표 지연 정렬: t ≥ H:40 이면 obs(H), 아니면 obs(H−1)

# ── 전처리 (설계서 §1 전처리 규칙) ───────────────────────────────────────
CSV_ENCODINGS = ("utf-8-sig", "cp949")   # 자동판별 후보 (실측: 이 둘로 전 파일 커버)
CONTROL_CENTER_KEYWORD = "관제"          # '타슈관제센터' 반납 행 제외용 키워드
# dedupe 키 — 완전 행 5키 (계약 §7에 확정 반영, 2026-09-14 합의). 3키(자전거·대여일시·
# 대여소)로 지우면 '0분 자기반납 + 진짜 여정' 쌍(같은 3키, 반납만 다름 — 22년08월 470건)
# 에서 진짜 반납이 임의로 소실된다. 폴더 간 중복(완전 동일 행)은 그대로 제거된다.
DEDUPE_KEYS = ("bike_id", "rented_at", "rental_station_id", "returned_at", "return_station_id")

# 알려진 시스템 장애(누락 마스크) 구간 — KST 정밀 시각, 반개구간 [start, end).
# 버킷 생성 시 이 구간은 행 자체를 만들지 않는다. 이벤트 공백 실측 기반으로 Spark와
# 동일 경계 — 계약 §1에 확정 반영됨 (2026-09-14 합의).
OUTAGE_RANGES = (
    ("2024-05-21 00:00", "2024-06-01 00:00"),  # 도시 전체 0건 11일 (2단계 자동 발견, 경계는 자정으로 실측 확인)
    ("2025-02-26 15:45", "2025-03-04 11:00"),  # 시스템 장애 — 마지막 이벤트 02-26 15:27, 재개 03-04 11:02 실측
    ("2025-12-01 00:00", "2026-01-01 00:00"),  # 2025-12 데이터 자체가 부재 ('25년12월' 파일 = 2025-01 복제본)
)

# ── 학습 (설계서 §5) ────────────────────────────────────────────────────
# 피처 컬럼·순서 — train/serve 일치의 기준. serve.py도 이 목록 그대로 행을 구성한다.
# current_bikes는 피처가 아님 (2층 수식의 s).
FEATURE_COLUMNS = (
    "station_id",  # categorical — 대여소 크기(수준) 신호. 실험 A(2026-09-15): 프로파일만으로는
                   # 베이스라인2(모양×크기)의 크기 인자를 못 따라가 deviance 2% 열세 → 직접 주입
    "slot_of_day", "weekday", "holiday_type",
    "temperature", "rainfall_1h", "minutes_since_rain",
    "profile_rentals", "profile_returns",
    "delta_30m", "delta_60m",
)
CATEGORICAL_FEATURES = ("station_id", "holiday_type")
HOLIDAY_TYPES = ("none", "major", "regular", "substitute", "workers_day")  # 카테고리 고정 (train/serve 동일 인코딩)

TARGETS = {"lambda": "rentals", "mu": "returns"}  # 모델명 → 라벨 컬럼

LGBM_PARAMS = dict(
    objective="poisson",
    n_estimators=2000,          # early stopping이 실제 트리 수를 결정
    learning_rate=0.05,
    num_leaves=255,        # 실험 B(2026-09-15): 127→255 — station_id 도입 후 조기 수렴(트리 절반) → 국소 패턴 용량 확대
    min_child_samples=100,  # 실험 B: 200→100
    subsample=0.8,
    subsample_freq=1,
    colsample_bytree=0.9,
    reg_lambda=1.0,
    n_jobs=-1,
    random_state=42,
    verbose=-1,
)
EARLY_STOPPING_ROUNDS = 100
EARLY_STOP_START = "2025-11-01"   # 학습 구간 마지막 실데이터 월을 early-stop 평가셋으로 (검증 3개월은 손대지 않음)
TRAIN_SAMPLE_FRACTION = None      # 메모리 부족 시 학습 행 서브샘플 비율 (예: 0.5). None = 전체
MODELS_DIR = ARTIFACTS_DIR / "models"

# ── 서빙 (계약 §8) ──────────────────────────────────────────────────────
SNAPSHOT_MATCH_TOLERANCE_MIN = 3     # delta 재현: 목표 시각 ±3분 내 스냅샷 없으면 NaN
REDIS_KEY_PATTERN = "pred:{station_id}:{horizon_min}"
REDIS_TTL_SECONDS = 180              # 2~3분 — 추론 중단 시 자연 소멸
