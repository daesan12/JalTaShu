# Spark 2대 성능 비교

이 폴더는 운영용 단일 노드 Spark 구성과 분리된 일시적인 성능시험 전용 구성이다.
Server B에서 Master, Worker B, Driver를 실행하고 Server A에서 Worker A를 추가해
같은 작업을 local, 1 Worker, 2 Workers로 반복한다.

## 파일 역할

| 경로 | 역할 | Secret 포함 여부 |
| --- | --- | --- |
| `compose.controller.yml` | Server B의 시험용 Master·Worker B·제출 컨테이너 | 없음 |
| `compose.worker.yml` | Server A에서 실행하는 시험용 Worker A | 없음 |
| `workload.py` | 같은 가상 자전거 데이터를 집계하는 재현 가능한 부하 | 없음 |
| `run-case.sh` | 조건과 Worker 수를 검사하고 결과 JSON 생성 | 없음 |
| `run-failure-recovery.sh` | 작업 도중 시험용 Worker 하나를 15초 중단하고 복구 여부를 검증 | 없음 |

## 통신 구조

기존 `infra/spark/compose.yml`은 Server B 내부 Docker network만 사용한다. 다른 EC2의
Worker가 참가하려면 Master, Worker RPC, Driver, Block Manager 주소와 포트를 사설 IP로
고정해야 한다. 시험 구성은 host network와 다음 포트를 사용한다.

| 서버 | 포트 | 목적 |
| --- | ---: | --- |
| Server B | 17077 | Worker가 Master에 등록 |
| Server B | 17080 | Executor가 Driver와 통신 |
| Server B | 17081, 17082 | Driver·Executor 데이터 블록 전송 |
| Server A | 17079 | Master가 Worker A에 작업 전달 |
| Server A | 17082 | Worker A Executor의 데이터 블록 전송 |

UI 포트 18181~18183은 UFW로 외부에 허용하지 않는다. 확인할 때만 SSH 터널을 사용한다.

## 비교 원칙

- `local`: Server B의 Driver 컨테이너 안에서 CPU 2개 사용
- `one-worker`: Server B Worker 1개, 총 CPU 2개 사용
- `two-workers`: Server A·B Worker 각 1개, 총 CPU 4개 사용
- 제출 Driver 컨테이너의 CPU 상한도 모든 조건에서 2개로 고정한다.
- 세 조건 모두 같은 행 수, 파티션 수, 계산식과 출력 checksum을 사용한다.
- 각 조건을 최소 3회 실행하고 첫 실행과 반복 실행을 구분한다.
- 작은 데이터에서는 네트워크·스케줄링 비용 때문에 2 Workers가 느릴 수 있다.

## 실행 전 확인

1. 기존 Server B Spark 사용자가 없는지 확인한다.
2. Server B UFW에 Server A 사설 IP 발신 17077, 17080~17082를 허용한다.
3. Server A UFW에 Server B 사설 IP 발신 17079, 17082를 허용한다.
4. 시험 후 컨테이너와 UFW 규칙을 제거하고 기존 Spark를 다시 시작한다.

## Worker 장애·복구 시험

이 시험은 시험용 Master에 Worker 두 개가 등록된 상태에서 실행한다. 두 executor가
실제로 Driver에 등록된 것을 로그로 확인한 뒤 Server B의 시험용 Worker만 15초
중단한다. 남은 Worker가 실패한 task를 다시 처리하고, 중단했던 Worker가 재등록된
뒤 전체 checksum이 같은지 확인한다.

```bash
sudo env \
  SPARK_MASTER_HOST=<Server-B-private-IP> \
  TASHU_BENCHMARK_ROWS=100000000 \
  TASHU_BENCHMARK_PARTITIONS=96 \
  TASHU_WORKER_OUTAGE_SECONDS=15 \
  /opt/tashu/spark/benchmark/run-failure-recovery.sh
```

결과와 Driver 로그는
`/srv/tashu/data/spark-benchmark/results/failure-recovery/`에 저장한다. 시험용 Worker
중단 또는 스크립트 오류가 생겨도 종료 trap이 Worker를 다시 시작한다. 이 스크립트는
운영 Spark Worker가 아니라 이름이 `tashu-spark-benchmark-worker-b`인 시험용
컨테이너만 대상으로 한다.
