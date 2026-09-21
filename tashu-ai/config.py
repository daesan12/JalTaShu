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
# 1~15분 1분 간격 (2026-09-17 백엔드 합의 — 경로 기능이 도보 ETA 분 그대로 조회:
# GET pred:{station_id}:{ETA분}). 검증된 5/10/15의 '사이'를 같은 두 버킷의 내분점으로
# 채우는 것이라 추가 검증 불요·추가 predict 없음(산수만). 15분 초과는 백테스트 후 결정.
HORIZONS_MIN = tuple(range(1, 16))

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
PROFILE_PATH = MODELS_DIR / "station_profile.parquet"  # 모델 3파일 중 하나 (S3 아티팩트 번들, 재계산 없음)

# 접속 정보는 환경변수로만 받는다 (비밀번호를 코드·Git에 두지 않음 — 인프라가 Secret으로 주입).
# 이름은 인프라와 합의된 값 (2026-09-16). MySQL은 준비 완료, Redis는 제안 중.
DB_ENV = dict(host="TASHU_AI_DB_HOST", port="TASHU_AI_DB_PORT", name="TASHU_AI_DB_NAME",
              user="TASHU_AI_DB_USER", password="TASHU_AI_DB_PASSWORD")
REDIS_ENV = dict(host="TASHU_AI_REDIS_HOST", port="TASHU_AI_REDIS_PORT", db="TASHU_AI_REDIS_DB",
                 password="TASHU_AI_REDIS_PASSWORD")
SNAPSHOT_TABLE = "station_availability"   # infra/mysql/schema/tashu-data.sql — 저장 시각은 UTC
WEATHER_TABLE = "weather_observation"

# 가동 점검 — 데이터 담당 활성화 조건 4개 (2026-09-16). 하나라도 실패하면 Redis에 쓰지 않는다.
SNAPSHOT_MAX_AGE_MIN = 2            # ① 최신 collected_at이 현재보다 이보다 오래되면 미가동
SNAPSHOT_HISTORY_MIN = 65           # ② 조회·요구 이력 창: delta_60m + 매칭 오차 3분 + 여유
WEATHER_HISTORY_HOURS = 24          # ③ minutes_since_rain 상한(1440분)을 판정하려면 24시간 이력 필요
#                                     ④ 완전 snapshot(COUNT(*) = station_count)만 사용 — SQL에서 필터
UNKNOWN_STATION_MAX_RATIO = 0.5     # 학습에 없던 station_id 비율이 이보다 크면 ID 포맷 불일치로 간주
SERVE_INTERVAL_SECONDS = 60         # 매분 배치
SERVE_TIME_BUDGET_SECONDS = 5       # 완료 기준: 1,374곳 × 3지평 < 5초 (초과 시 경고 로그)

# ── 캘리브레이션·백테스트 (9·10단계, 설계서 §6) ───────────────────────────
# 홀드아웃 = 자체 수집 스냅샷(S3 bronze/realtime). 학습에 절대 쓰지 않는다.
# S3는 파이썬이 직접 읽지 않고 `aws s3 sync`로 아래 로컬 폴더에 내려받은 Parquet만 읽는다
# (자격증명은 사용자 PC의 aws profile에만 — 코드·저장소에 두지 않음).
S3_REALTIME_PREFIX = "s3://s15p21b103-tashu-datalake/bronze/realtime/"
S3_LOCAL_ROOT = DATA_ROOT / "s3" / "realtime"          # ← aws s3 sync 대상. 하위: snapshots/dt=…, weather/observations/dt=…
SNAPSHOT_PARQUET_DIR = S3_LOCAL_ROOT / "snapshots"
WEATHER_PARQUET_DIR = S3_LOCAL_ROOT / "weather" / "observations"
# 기상청 수집이 없는 구간(2026-09-16 이전)은 학습과 같은 소스(Open-Meteo, 계약 §6)로 채운다.
# dev/fetch_openmeteo_weather.py 가 같은 dt= 파티션 형식으로 저장. 기상청 관측이 있는 시각은 기상청 우선.
WEATHER_BACKFILL_DIR = S3_LOCAL_ROOT / "weather" / "openmeteo"
OPENMETEO_LAT, OPENMETEO_LON = 36.3504, 127.3845   # 대전 (기상청 격자 nx67·ny100 인근)
REPLAY_DIR = ARTIFACTS_DIR / "replay"                  # 시점별 예측 vs 실제 테이블 (Parquet)
# S3 스냅샷엔 station_count가 없어 '완전' = 행 수 ≥ 그날 최대 행 수 × 이 비율. 실측(2026-09-10): API가
# 스냅샷마다 1,368~1,374곳을 돌려줘(대여소 몇 곳의 일시 누락은 정상) 최대치와 같음을 요구하면 70%가 버려진다.
# 페이지 누락(~1,000행 결손)만 걸러내는 것이 목적.
SNAPSHOT_COMPLETE_RATIO = 0.98
REPLAY_STEP_MIN = 5                  # 리플레이 평가 시점 간격 (1분이면 7일 ≈ 3시간, 5분이면 ≈ 35분)
EVAL_HORIZONS_MIN = (5, 10, 15, 30, 45, 60)  # 지표 산출 지평 — 30~60분은 1시간 확장 검증용 (2026-09-21)

# 서빙·리플레이가 만드는 피처 행의 버킷 수: [t, t+h)가 최대 h/15+1개 버킷에 걸친다.
# HORIZONS_MIN(서빙)과 EVAL_HORIZONS_MIN(리플레이 평가) 중 긴 쪽 기준으로 자동 산출 —
# 지평을 늘릴 때 이 값을 따로 만질 필요 없음. (60분 → 5개, 15분 → 2개)
N_FEATURE_BUCKETS = max(max(HORIZONS_MIN), max(EVAL_HORIZONS_MIN)) // BUCKET_MINUTES + 1
CALIBRATION_BINS = 10                # 캘리브레이션 곡선 구간 수
TAIL_CORRECTION_GRID = tuple(round(1.0 + 0.05 * i, 2) for i in range(11))  # 1.00 ~ 1.50 (실측 낙관 편향 1.03~1.28배)
# 서빙에 적용하는 보정계수 (단일값, 전 지평·전 대여소). 2026-09-17 캘리브레이션(9/9~9/16 홀드아웃, 결정 구간 s≥1)에서
# Brier 최소가 5/10/15분 = 1.35/1.25/1.20 — 지평별 차이는 1주치 잡음 범위라 중앙값 하나로 확정. 재실행 때 다시 확인.
TAIL_CORRECTION = 1.25
DEPLETION_BIKES = 0                  # '고갈' = 도착 시점 잔여 ≤ 이 값

# 백테스트 (10단계, 설계서 §6-3): "추천 여정 vs 현재 잔여 기준 최단 여정 → 헛걸음 감소율"
BACKTEST_K_NEAREST = 4               # 출발 위치(각 대여소) 주변 후보 대여소 수 (자기 자신 포함)
BACKTEST_MAX_WALK_M = 1200           # 후보 반경(m) — 이보다 멀면 후보 아님
BACKTEST_WALK_SPEED_MPM = 80         # 도보 속도 m/분 (≈4.8 km/h)
BACKTEST_FAIL_PENALTY_MIN = 8        # 헛걸음 시 다음 대여소까지 추가 이동 시간(분) — 기대비용식의 벌점
