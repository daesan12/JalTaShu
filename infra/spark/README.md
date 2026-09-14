# Spark 단일 노드 기반

Server B에서 Spark Standalone Master, Worker, History Server를 실행하는 구성이다.
현재는 Server B 한 대에서 Worker 1개를 사용해 실행 방법과 기준 성능을 먼저 검증한다.
이 구성은 고가용성 클러스터가 아니다. 이후 성능시험 때만 Server A Worker를 추가해
같은 작업을 Worker 1개와 2개로 실행하고 데이터 크기별 성능과 장애 격리 효과를 비교한다.

## 파일 역할

| 경로 | 역할 | Secret 포함 여부 |
| --- | --- | --- |
| `compose.yml` | Master, Worker, History Server의 컨테이너·자원·네트워크 정의 | 없음 |
| `conf/spark-defaults.conf` | 이벤트 로그, 시간대, 기본 파티션 등 공통 설정 | 없음 |
| `scripts/bootstrap-dirs.sh` | 호스트 데이터 디렉터리와 Spark UID/GID 권한 생성 | 없음 |
| `scripts/smoke-test.sh` | SparkPi 작업을 제출해 Master와 Worker 연결 검증 | 없음 |

모든 파일은 Git으로 관리한다. 비밀번호, AWS 키, Kafka 인증정보는 이 폴더에 넣지 않는다.

## Server B 경로

| 서버 경로 | 역할 |
| --- | --- |
| `/opt/tashu/spark` | Git으로 관리되는 실행 설정과 스크립트 |
| `/srv/tashu/data/spark/events` | 완료된 Spark 애플리케이션의 이벤트 로그 |
| `/srv/tashu/data/spark/checkpoints` | 향후 Structured Streaming 재시작 지점 |
| `/srv/tashu/data/spark/output` | 검증·벤치마크 결과 |
| `/srv/tashu/data/spark/work` | Worker가 실행 중 사용하는 임시 작업 파일 |

## 서비스 역할

- Master는 실행 가능한 Worker와 자원을 관리한다.
- Worker는 CPU와 메모리를 제공해 실제 계산을 수행한다.
- History Server는 이벤트 로그를 읽어 종료된 작업의 단계와 소요 시간을 보여준다.
- `spark-submit`은 작업 제출 시에만 만들어지고 작업이 끝나면 제거된다.

웹 UI는 Server B의 루프백 주소에만 연다. 인터넷에 공개하지 않고 SSH 터널로 확인한다.

| UI | Server B 바인딩 | SSH 터널 연결 후 로컬 주소 |
| --- | --- | --- |
| Master | `127.0.0.1:18081` | `http://127.0.0.1:18081` |
| Worker | `127.0.0.1:18082` | `http://127.0.0.1:18082` |
| History | `127.0.0.1:18080` | `http://127.0.0.1:18080` |

## 최초 실행

```bash
sudo /opt/tashu/spark/scripts/bootstrap-dirs.sh
sudo docker compose -f /opt/tashu/spark/compose.yml config
sudo docker compose -f /opt/tashu/spark/compose.yml up -d spark-master spark-worker spark-history
sudo docker compose -f /opt/tashu/spark/compose.yml ps
sudo /opt/tashu/spark/scripts/smoke-test.sh
```

정상이라면 세 컨테이너가 `healthy`이고 SparkPi 출력의 Pi 값이 약 3.14이다.
작업 종료 뒤 History Server에서 SparkPi 실행 기록을 확인할 수 있다.

## 중지와 재시작

```bash
sudo docker compose -f /opt/tashu/spark/compose.yml stop
sudo docker compose -f /opt/tashu/spark/compose.yml start
```

컨테이너와 Docker 네트워크만 제거하고 호스트의 이벤트 로그와 체크포인트를 보존하려면 다음을 실행한다.

```bash
sudo docker compose -f /opt/tashu/spark/compose.yml down
```

데이터 디렉터리는 bind mount이므로 `down` 명령으로 삭제되지 않는다.

## 다음 단계

1. Spark Kafka connector를 Spark·Scala 버전에 맞게 고정한다.
2. `tashu.station-availability.v1`을 읽는 schema smoke consumer를 만든다.
3. `snapshot_id` 기반 중복 방지와 checkpoint 복구를 검증한다.
4. 성능시험 때만 Server A Worker를 실행해 Worker 1개와 2개를 비교한다.
5. 같은 입력·출력·파티션으로 local, Worker 1개, Worker 2개 결과의 정확성과 시간을 기록한다.

## 공식 문서

- https://spark.apache.org/docs/4.1.3/spark-standalone.html
- https://spark.apache.org/docs/4.1.3/configuration.html
- https://spark.apache.org/docs/4.1.3/streaming-kafka-integration.html
- https://hub.docker.com/_/spark
