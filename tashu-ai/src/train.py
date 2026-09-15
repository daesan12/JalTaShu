# -*- coding: utf-8 -*-
"""5단계: LightGBM 회귀 ×2 (objective=poisson) — λ̂ 대여율·μ̂ 반납률 + 베이스라인 2종 비교.

실행:  tashu-ai/ 디렉터리에서  python -m src.train
(입력: Spark train_buckets — 완전 중복 제거본 재수령 후 실행할 것. crosscheck_spark 전 항목
 PASS 확인이 선행 조건.)

프로토콜 (설계서 §5):
- 분할: bucket_start < 2026-01-01 KST 학습 / ≥ 검증 3개월. 랜덤 분할 금지.
- early stopping 평가셋은 학습 구간의 마지막 실데이터 월(2025-11) — 검증 3개월은
  최종 평가 전까지 어떤 선택에도 쓰지 않는다.
- 지표: Poisson deviance·MAE. accuracy 금지.
- 베이스라인 ①프로파일(요일·시간 과거 평균) ②모양×크기 분해 — 항상 같은 지표로 병기.
  베이스라인을 못 이기면 피처부터 의심 (가이드 표 5).
- 평가는 프로파일 보유 / 신규 대여소 분리 집계 (계약 §5 — 콜드스타트 한계 수치).

메모리 주의: 학습 테이블 ~1.5억 행. float32/카테고리 다운캐스트로 로드하며,
부족하면 config.TRAIN_SAMPLE_FRACTION으로 학습 구간만 서브샘플 (검증은 항상 전체).
"""
from __future__ import annotations

import io
import sys
import time
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_poisson_deviance

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import config

SPARK_BUCKETS = config.SPARK_DIR / "train_buckets"
PRED_CLIP_MIN = 1e-6  # Poisson deviance는 ŷ>0 필요 — 0 예측 클립용 (지표 계산 한정)

# dict.fromkeys: station_id가 피처(FEATURE_COLUMNS)이기도 해서 중복 제거 필수 —
# 중복 컬럼 목록으로 read_parquet하면 같은 컬럼이 두 번 생겨 LightGBM이 죽는다 (실측)
LOAD_COLUMNS = list(dict.fromkeys(["station_id", "bucket_start", "rentals", "returns", *config.FEATURE_COLUMNS]))
DTYPES = {
    "rentals": "int16", "returns": "int16",
    "slot_of_day": "int16", "weekday": "int8",
    "temperature": "float32", "rainfall_1h": "float32", "minutes_since_rain": "float32",
    "profile_rentals": "float32", "profile_returns": "float32",
    "delta_30m": "float32", "delta_60m": "float32",
}


# ── 데이터 적재·분할 ─────────────────────────────────────────────────────

def load_table(log: io.TextIOBase) -> pd.DataFrame:
    files = sorted(SPARK_BUCKETS.glob("*.parquet"))
    if not files:
        raise FileNotFoundError(f"train_buckets 없음: {SPARK_BUCKETS}")
    frames = []
    for f in files:
        part = pd.read_parquet(f, columns=LOAD_COLUMNS)
        part = part.astype(DTYPES)
        frames.append(part)
    df = pd.concat(frames, ignore_index=True)
    df["bucket_start"] = df["bucket_start"].dt.tz_convert(config.TZ)
    df["station_id"] = df["station_id"].astype("category")
    # holiday_type: train/serve 동일 인코딩을 위해 카테고리 목록 고정
    df["holiday_type"] = pd.Categorical(df["holiday_type"], categories=list(config.HOLIDAY_TYPES))
    print(f"train_buckets 로드: {len(files)}개 파일, {len(df):,}행", file=log)
    return df


def split_sets(df: pd.DataFrame, log: io.TextIOBase):
    """학습(core)/early-stop(학습 마지막 월)/검증 — 전부 시간 경계 분할. 랜덤 분할 금지."""
    split = pd.Timestamp(config.SPLIT_DATE, tz=config.TZ)
    es_start = pd.Timestamp(config.EARLY_STOP_START, tz=config.TZ)
    valid = df[df["bucket_start"] >= split]
    core = df[df["bucket_start"] < es_start]
    es = df[(df["bucket_start"] >= es_start) & (df["bucket_start"] < split)]
    if config.TRAIN_SAMPLE_FRACTION is not None:
        n0 = len(core)
        core = core.sample(frac=config.TRAIN_SAMPLE_FRACTION, random_state=42)
        print(f"⚠ 학습 서브샘플 {config.TRAIN_SAMPLE_FRACTION}: {n0:,} → {len(core):,}행", file=log)
    print(f"분할 — 학습 {len(core):,} / early-stop({config.EARLY_STOP_START}~) {len(es):,} / 검증 {len(valid):,}행", file=log)
    return core, es, valid


def feature_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """모델 입력 행렬 — config.FEATURE_COLUMNS 순서 고정 (train/serve 일치의 물리적 기준)."""
    return df[list(config.FEATURE_COLUMNS)]


# ── 모델 ────────────────────────────────────────────────────────────────

def fit_lgbm(core: pd.DataFrame, es: pd.DataFrame, label_col: str, log: io.TextIOBase) -> lgb.LGBMRegressor:
    model = lgb.LGBMRegressor(**config.LGBM_PARAMS)
    model.fit(
        feature_matrix(core), core[label_col],
        eval_X=feature_matrix(es), eval_y=es[label_col],
        eval_metric="poisson",
        callbacks=[lgb.early_stopping(config.EARLY_STOPPING_ROUNDS, verbose=False)],
        categorical_feature=list(config.CATEGORICAL_FEATURES),
    )
    print(f"[{label_col}] best_iteration={model.best_iteration_}", file=log)
    imp = sorted(zip(config.FEATURE_COLUMNS, model.feature_importances_), key=lambda x: -x[1])
    print(f"[{label_col}] 피처 중요도: " + ", ".join(f"{k}={v}" for k, v in imp), file=log)
    return model


# ── 베이스라인 2종 (학습 구간만으로 구성) ────────────────────────────────

def baseline_profile(train: pd.DataFrame, valid: pd.DataFrame, label_col: str) -> pd.Series:
    """베이스라인 ①: station×weekday×slot 과거 평균 = 테이블의 profile 컬럼 그대로.

    신규 대여소(profile NaN)는 학습 구간의 weekday×slot 전 대여소 평균으로 대체
    (베이스라인은 예측을 반드시 내야 하므로 — 모델의 NaN 유지 원칙과 무관).
    """
    profile_col = "profile_rentals" if label_col == "rentals" else "profile_returns"
    cell_mean = train.groupby(["weekday", "slot_of_day"], observed=True)[label_col].mean().rename("_cell")
    pred = valid[[profile_col, "weekday", "slot_of_day"]].join(cell_mean, on=["weekday", "slot_of_day"])
    return pred[profile_col].astype("float64").fillna(pred["_cell"])


def baseline_shape_size(train: pd.DataFrame, valid: pd.DataFrame, label_col: str) -> pd.Series:
    """베이스라인 ②: 모양×크기 분해 (EDA R² 0.83의 재현) — 학습 구간만 사용.

    pred(station, w, s) = station 평균 × (도시 전체 (w,s)셀 평균 / 도시 전체 평균).
    신규 대여소는 station 평균 대신 전체 평균(= 셀 평균 그대로) 사용.
    """
    overall = train[label_col].mean()
    station_mean = train.groupby("station_id", observed=True)[label_col].mean().rename("_size")
    cell_mean = train.groupby(["weekday", "slot_of_day"], observed=True)[label_col].mean().rename("_shape")
    pred = (
        valid[["station_id", "weekday", "slot_of_day"]]
        .join(station_mean, on="station_id")
        .join(cell_mean, on=["weekday", "slot_of_day"])
    )
    size = pred["_size"].astype("float64").fillna(overall)
    return (size * pred["_shape"] / overall).clip(lower=0.0)


# ── 평가 (설계서 §5: Poisson deviance·MAE, 프로파일 보유/신규 분리) ───────

def metrics(y: pd.Series, pred: pd.Series) -> tuple[float, float]:
    pred_safe = np.clip(np.asarray(pred, dtype="float64"), PRED_CLIP_MIN, None)
    return (
        float(mean_poisson_deviance(y, pred_safe)),
        float(mean_absolute_error(y, pred)),
    )


def evaluate(valid: pd.DataFrame, label_col: str, preds: dict[str, pd.Series], log: io.TextIOBase) -> pd.DataFrame:
    has_profile = valid["profile_rentals"].notna()
    groups = {"전체": pd.Series(True, index=valid.index), "프로파일 보유": has_profile, "신규(콜드스타트)": ~has_profile}
    rows = []
    for name, pred in preds.items():
        for gname, mask in groups.items():
            if not mask.any():
                continue
            dev, mae = metrics(valid.loc[mask, label_col], pred[mask])
            rows.append({"모델": name, "그룹": gname, "n": int(mask.sum()),
                         "poisson_deviance": round(dev, 5), "MAE": round(mae, 5)})
    table = pd.DataFrame(rows)
    print(f"\n== {label_col} (λ={label_col=='rentals'}) 검증 성능 — 2026-01~03 ==", file=log)
    print(table.to_string(index=False), file=log)
    lgbm_dev = table[(table["모델"] == "LightGBM") & (table["그룹"] == "전체")]["poisson_deviance"].iloc[0]
    best_base = table[(table["모델"] != "LightGBM") & (table["그룹"] == "전체")]["poisson_deviance"].min()
    if lgbm_dev >= best_base:
        print("⚠⚠ LightGBM이 베이스라인을 못 이김 — 피처부터 의심하라 (가이드 표 5)", file=log)
    return table


# ── 메인 ────────────────────────────────────────────────────────────────

def main() -> None:
    log = io.StringIO()
    t0 = time.monotonic()
    df = load_table(log)
    core, es, valid = split_sets(df, log)
    del df

    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    config.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    all_tables = []
    for model_name, label_col in config.TARGETS.items():
        model = fit_lgbm(core, es, label_col, log)
        preds = {
            "LightGBM": pd.Series(model.predict(feature_matrix(valid)), index=valid.index),
            "베이스라인1(프로파일)": baseline_profile(core, valid, label_col),
            "베이스라인2(모양×크기)": baseline_shape_size(core, valid, label_col),
        }
        table = evaluate(valid, label_col, preds, log)
        table.insert(0, "target", model_name)
        all_tables.append(table)
        path = config.MODELS_DIR / f"lgbm_{model_name}.joblib"
        joblib.dump(model, path)
        print(f"모델 저장: {path}", file=log)

    pd.concat(all_tables, ignore_index=True).to_csv(
        config.REPORTS_DIR / "train_comparison.csv", index=False, encoding="utf-8-sig"
    )
    print(f"\n총 소요 {time.monotonic()-t0:.0f}s", file=log)
    (config.REPORTS_DIR / "train_report.txt").write_text(log.getvalue(), encoding="utf-8")
    try:
        print(log.getvalue())
    except UnicodeEncodeError:
        sys.stdout.buffer.write(log.getvalue().encode("utf-8", errors="replace"))


if __name__ == "__main__":
    main()
