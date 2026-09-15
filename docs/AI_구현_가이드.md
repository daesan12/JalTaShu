# AI 구현 가이드 — 모듈 구조 · 작업 순서 · 완료 기준

Claude Code로 개발할 때 이 순서대로 한 단계씩 시킨다. 각 단계는 독립 커밋이 되게, "완료 기준"이 통과해야 다음으로.

## 모듈 구조

```
tashu-ai/
├─ CLAUDE.md                  # 이 패키지의 CLAUDE.md
├─ docs/                      # AI_설계서, 피처_스키마_계약, 이 가이드
├─ config.py                  # 경로·분할 날짜(2026-01-01)·지평(5,10,15)·임계값(|delta|>20, 강수 1mm)·버킷 15분
├─ src/
│  ├─ preprocess.py           # CSV 로드(인코딩 자동판별)·대여일시 파티셔닝·관제센터 제외·dedupe
│  ├─ buckets.py              # 15분 버킷 집계(rentals/returns)·누락 마스크·운영 구간 0-fill
│  ├─ features.py             # ★학습·서빙 공용: 날씨 정렬·holiday·minutes_since_rain·delta·프로파일 조인
│  ├─ profile.py              # station_profile 생성(학습 구간만)
│  ├─ train.py                # LightGBM ×2 (objective=poisson) + 베이스라인 2종
│  ├─ probability.py          # 지평 가중합·예상 잔여·포아송 꼬리·(후반) 보정계수/isotonic
│  ├─ serve.py                # 매분 배치: 피처 행 2개/대여소 → predict → Redis 쓰기(TTL)
│  ├─ calibrate.py            # (4주차~) 스냅샷 대조·캘리브레이션 곡선·보정 산출
│  └─ backtest.py             # (5주차~) 스냅샷 리플레이 → "헛걸음 N% 감소"
└─ tests/                     # 계약 검수 체크 5개 = pytest
```

`features.py`가 심장이다 — **학습 파이프라인과 serve.py가 같은 함수를 import**해야 train/serve 일치가 구조적으로 보장된다.

## 작업 순서 (단계 = 커밋)

| # | 작업 | 완료 기준 (Definition of Done) |
|---|---|---|
| 1 | `config.py` + `preprocess.py` | 전 CSV 로드 성공, **월별 행수 히스토그램 출력**(사용 월 확정 근거), dedupe 후 행수 리포트 |
| 2 | `buckets.py` | 검수 1: 임의 하루 행수 = 그날 운영 대여소 수 × 96. 검수 4: 마스크 구간 행수 0 + 도시 전체 0건 날짜 ⊆ 마스크 |
| 3 | `profile.py` + `features.py` (정적 피처) | 학습 구간만으로 계산됨을 테스트로 확인(2026년 데이터 넣으면 실패해야 함). 날씨 발표지연 정렬 단위 테스트 |
| 4 | `features.py` (delta) | 검수 2: 임의 3곳 delta_30m 수동 대조. NaN 규칙(\|delta\|>20, 60분 미만) 테스트 |
| 5 | `train.py` | λ·μ 모델 + 베이스라인 2종의 Poisson deviance/MAE 비교표 출력. **베이스라인을 못 이기면 피처부터 의심** |
| 6 | `probability.py` | 지평 가중합 단위 테스트(경계 케이스: 정각 출발, h=15 정확히 한 버킷). 포아송 꼬리 vs scipy 대조 |
| 7 | `serve.py` | 매분 실행 1,374곳 × 3지평 < 5초. Redis 키·TTL 확인. 추론 프로세스 kill 후 TTL 만료 → 키 소멸 확인 |
| 8 | 검수 3 (train/serve 일치) | 같은 시각의 학습 피처 행과 서빙 피처 행 컬럼별 값 일치 (허용 오차 내) |
| 9 | `calibrate.py` (스냅샷 1~2주 후) | 캘리브레이션 곡선 출력, 낙관 편향 측정 → 보정계수 확정 |
| 10 | `backtest.py` (스냅샷 3주 후) | "추천 따랐다면 헛걸음 N% 감소" 수치 산출 (발표 핵심) |

## Claude Code 사용 팁 (이 프로젝트 한정)

- 한 세션에 한 단계만. "2단계 buckets.py 구현해줘, 완료 기준은 가이드 표 참조" 식으로.
- 계약 문서를 어기는 제안(결측 채우기, 랜덤 분할, is_weekend 추가 등)이 나오면 계약이 이긴다고 답할 것 — 문서에 이유가 다 적혀 있다.
- 시키기 전에 데이터 샘플(파일 몇 줄)을 같이 보여주면 인코딩·컬럼명 추측 실수가 준다.
- 데이터 담당이 Colab에서 만든 전처리와 겹치는 부분(weekday·holiday·날씨)은 **코드를 받아 features.py로 이식**하는 게 재작성보다 안전 — train/serve 일치 원칙의 연장.
