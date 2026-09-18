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
| `scripts/cache-kafka-connector.sh` | Spark 4.1.3용 공식 Kafka connector를 한 번 받아 cache | 없음 |
| `scripts/cache-mysql-connector.sh` | 공식 MySQL Connector/J 9.6.0을 한 번 받아 cache | 없음 |
| `scripts/submit-data-job.sh` | 데이터 작업 폴더 안의 Python 파일만 고정된 Spark 자원으로 제출 | 없음 |
| `scripts/configure-data-user-access.sh` | `tashu-data` 계정에 위 제출 명령 하나만 허용하는 sudoers 설정 설치 | 없음 |
| `scripts/configure-mysql-writer-credential.sh` | MySQL writer Secret을 Server B root 전용 경로에 저장 | 입력값만 Secret |
| `scripts/mysql-jdbc-smoke-test.py` | 실제 Spark executor에서 MySQL 읽기와 UTC session을 검증 | 없음 |

모든 파일은 Git으로 관리한다. 비밀번호, AWS 키, Kafka 인증정보는 이 폴더에 넣지 않는다.

## Server B 경로

| 서버 경로 | 역할 |
| --- | --- |
| `/opt/tashu/spark` | Git으로 관리되는 실행 설정과 스크립트 |
| `/srv/tashu/data/spark/events` | 완료된 Spark 애플리케이션의 이벤트 로그 |
| `/srv/tashu/data/spark/checkpoints` | 향후 Structured Streaming 재시작 지점 |
| `/srv/tashu/data/spark/output` | 검증·벤치마크 결과 |
| `/srv/tashu/data/spark/work` | Worker가 실행 중 사용하는 임시 작업 파일 |
| `/srv/tashu/data/spark/ivy` | Spark 4.1.3 Kafka connector와 의존성의 재사용 cache |
| `/etc/tashu/streaming/mysql-data-writer.env` | root만 읽고 Spark 제출 컨테이너에만 전달하는 MySQL JDBC URL·writer Secret |

## 서비스 역할

- Master는 실행 가능한 Worker와 자원을 관리한다.
- Worker는 CPU와 메모리를 제공해 실제 계산을 수행한다.
- History Server는 이벤트 로그를 읽어 종료된 작업의 단계와 소요 시간을 보여준다.
- `spark-submit`은 작업 제출 시에만 만들어지고 작업이 끝나면 제거된다.

웹 UI는 Server B의 루프백 주소에만 연다. 인터넷에 공개하지 않고 SSH 터널로 확인한다.

Spark Docker network는 `172.30.20.0/24`로 고정한다. Server B UFW에는 이 내부 대역에서
Server B 사설 주소의 Kafka `9092`로 가는 TCP 연결만 허용한다. 외부 인터넷과 다른
서비스 포트는 열지 않는다.

Spark의 MySQL 연결은 Server B 사설 IP `172.26.4.110`에서 Server A 사설 IP
`172.26.8.114:3306`으로만 허용한다. MySQL은 공개 주소에 bind하지 않고 Server A UFW에도
Server B 한 대만 등록한다. 사람은 이 포트를 직접 사용하지 않고 DBeaver SSH tunnel을 사용한다.

```bash
sudo ufw allow from 172.30.20.0/24 to <SERVER_B_PRIVATE_IP> port 9092 proto tcp comment 'Kafka from Spark containers'
```

되돌릴 때는 같은 조건으로 규칙만 삭제한다.

```bash
sudo ufw delete allow from 172.30.20.0/24 to <SERVER_B_PRIVATE_IP> port 9092 proto tcp
```

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

## 데이터 담당자 작업 제출

데이터 담당자 코드는 `/srv/tashu/workspace/data` 아래에 둔다. 이 폴더는 Git 저장소가 아니며
실험 중인 PySpark 코드와 임시 결과를 보관하는 서버 작업 공간이다. PEM, API key, 비밀번호는
이 폴더에 저장하지 않는다.

인프라 담당자가 제한 권한을 한 번 설치한다.

```bash
sudo /opt/tashu/spark/scripts/cache-kafka-connector.sh
sudo /opt/tashu/spark/scripts/cache-mysql-connector.sh
sudo /opt/tashu/spark/scripts/configure-data-user-access.sh
```

이 설정은 `tashu-data`를 Docker group에 넣지 않는다. 대신 root가 소유한 제출 script 하나만
비밀번호 없이 실행하도록 `/etc/sudoers.d/tashu-data-spark-submit`에 허용한다. 제출 script는
workspace 밖 경로와 Python 이외 파일을 거부하고 Master·Worker가 healthy일 때만 고정된 CPU와
메모리 설정으로 작업을 실행한다.

데이터 담당자는 workspace 기준 상대 경로로 작업을 제출한다.

```bash
sudo /opt/tashu/spark/scripts/submit-data-job.sh jobs/streaming_consumer.py
```

Python 파일은 submit container에 read-only로 연결된다. 작업이 쓰는 결과와 checkpoint는 기존
`/srv/tashu/data/spark` 하위 경로를 사용한다.

장시간 실행하는 Kafka → MySQL Structured Streaming 작업은 터미널에서 직접 유지하지 않고
`tashu-kafka-mysql-streaming.service`가 관리한다. 병합된 작업 파일을 인자로 한 번 설치한다.

```bash
sudo /opt/tashu/spark/scripts/install-kafka-mysql-streaming-service.sh \
  /tmp/tashu-streaming/data-pipeline/streaming/jobs/kafka_mysql_streaming.py
```

설치 script는 작업 파일을 `/srv/tashu/workspace/data/jobs/`에 배치하고 systemd unit을 설치한 뒤
즉시 활성화한다. 서비스는 전용 `tashu-kafka-mysql-streaming` submit container만 사용하며 실패하면
15초 뒤 재시작한다. 서버 재부팅 뒤에도 자동 시작한다.

```bash
sudo systemctl status tashu-kafka-mysql-streaming --no-pager -l
sudo journalctl -u tashu-kafka-mysql-streaming -n 100 --no-pager
sudo docker ps --filter name=tashu-kafka-mysql-streaming
```

checkpoint와 dead-letter는 container 밖의 다음 경로에 남으므로 서비스와 container를 재시작해도
유지된다.

```text
/srv/tashu/data/spark/checkpoints/kafka-mysql-v1/station
/srv/tashu/data/spark/checkpoints/kafka-mysql-v1/weather
/srv/tashu/data/spark/output/dead-letter/kafka-mysql-v1/
```

운영 중 checkpoint를 삭제하지 않는다. 서비스를 되돌릴 때는 작업을 중지·비활성화하되 checkpoint와
dead-letter는 보존한다.

```bash
sudo systemctl disable --now tashu-kafka-mysql-streaming
```

관리자용 cache 명령은 Spark 4.1.3과 같은 버전의 공식 Kafka connector
`org.apache.spark:spark-sql-kafka-0-10_2.13:4.1.3`을 Maven Central에서 한 번 받아
`/srv/tashu/data/spark/ivy`에 보관한다. 데이터 담당자의 제출 명령은 외부에서 library를 다시
받지 않고 검증된 cache를 read-only로 연결한다.

MySQL JDBC도 공식 Connector/J `com.mysql:mysql-connector-j:9.6.0`을 같은 cache에 고정한다.
Spark SQL session과 JDBC connection session은 모두 UTC다. 제출 script는
`/etc/tashu/streaming/mysql-data-writer.env`를 컨테이너 환경으로만 주입하며 Secret을 workspace,
Git과 명령 인자에 기록하지 않는다.

## 다음 단계

1. 데이터 담당자의 실제 Structured Streaming consumer를 작업 폴더에 배치한다.
2. `snapshot_id` 기반 중복 방지와 checkpoint 복구를 검증한다.
3. 성능시험 때만 Server A Worker를 실행해 Worker 1개와 2개를 비교한다.
4. 같은 입력·출력·파티션으로 local, Worker 1개, Worker 2개 결과의 정확성과 시간을 기록한다.

## 공식 문서

- https://spark.apache.org/docs/4.1.3/spark-standalone.html
- https://spark.apache.org/docs/4.1.3/configuration.html
- https://spark.apache.org/docs/4.1.3/streaming-kafka-integration.html
- https://hub.docker.com/_/spark
