# Spark local·Worker 성능 비교

같은 Spark 집계 작업을 `local`, `1 Worker`, `2 Workers`에서 각각 3회 실행한 결과다. 실행 환경과 재현 스크립트는 `infra/spark/benchmark/`에 있다.

## 실행 조건

- Spark 4.1.3
- 합성 입력 50,000,000행
- 입력 partition 96개
- Driver CPU 상한 2개
- local: Driver 내부 thread 2개
- 1 Worker: CPU 2개, executor memory 2 GiB
- 2 Workers: 서버마다 CPU 2개, 총 CPU 4개, executor memory 각 2 GiB

## 결과

| 방식 | 1회 | 2회 | 3회 | 중앙값 | local 대비 |
| --- | ---: | ---: | ---: | ---: | ---: |
| local | 24.355초 | 24.405초 | 24.539초 | 24.405초 | 기준 |
| 1 Worker | 25.938초 | 25.834초 | 26.140초 | 25.938초 | 6.3% 느림 |
| 2 Workers | 18.589초 | 19.243초 | 20.034초 | 19.243초 | 21.1% 빠름 |

2 Workers는 1 Worker보다 중앙값 기준 약 25.8% 빨랐다. 같은 CPU 2개를 사용한 local과 1 Worker 비교에서는 별도 프로세스와 통신 비용 때문에 1 Worker가 느렸다. 두 서버를 사용하면 총 CPU가 4개가 되어 그 비용보다 병렬 처리 이득이 커졌다.

## 결과 무결성

9회 실행 모두 다음 값이 같았다.

- 처리 행 수: `50,000,000`
- 집계 group 수: `131,904`
- metric 합계: `24,979,068,663`
- group별 metric 최대값 합계: `131,486,213`

실행시간만 비교하고 계산 결과가 달라지는 실수를 피하기 위해 이 값을 checksum으로 사용했다. 원본 실행값은 [2026-09-15-synthetic-50m.json](results/2026-09-15-synthetic-50m.json)에 있다.

## 제외한 사전 측정

첫 5천만 행 측정은 제출 Driver 컨테이너 CPU 상한이 1개여서 `local[2]`가 실제로 CPU 2개를 충분히 쓰지 못했다. local에 불리한 비교이므로 최종 결과에서 제외했다. 위 표는 CPU 상한을 세 조건 모두 2개로 맞춘 뒤 다시 측정한 값만 사용한다.

## 해석 범위

이 결과는 두 대의 동일 사양 EC2와 현재 합성 집계 부하에서 얻었다. 모든 Spark 작업이 항상 25.8% 빨라진다는 뜻은 아니다. 데이터 크기, shuffle 양, network 속도, partition 수에 따라 차이가 달라질 수 있다.
