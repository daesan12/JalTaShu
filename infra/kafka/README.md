# Kafka single-broker KRaft baseline

Server B에 Apache Kafka 단일 broker를 KRaft combined mode로 실행한다. Collector와 Spark 사이의 장애 격리, backlog, replay를 학습하고 검증하기 위한 구성이다. broker와 controller가 한 컨테이너에 있으므로 고가용성 구성은 아니다.

공식 Apache Kafka `4.3.1` JVM Docker image를 고정해서 사용한다. 움직이는 `latest` tag는 사용하지 않는다.

## 파일과 서버 경로

| 경로 | 역할 | Git/Secret |
| --- | --- | --- |
| `infra/kafka/compose.yml` | broker·controller listener, 자원 제한, 보존 기간과 volume 정의 | Git 추적, Secret 없음 |
| `infra/kafka/scripts/bootstrap-env.sh` | Server B 사설 IP와 cluster ID를 서버 전용 환경파일로 생성 | Git 추적, Secret 없음 |
| `infra/kafka/scripts/smoke-test.sh` | 임시 topic을 만들고 한 메시지를 produce·consume한 뒤 삭제 | Git 추적, Secret 없음 |
| `infra/kafka/scripts/ensure-topics.sh` | 합의된 운영 topic을 생성하고 partition·복제 수·보존 기간을 검증 | Git 추적, Secret 없음 |
| `/opt/tashu/kafka` | Server B에 배포한 Compose와 스크립트 | 서버 운영 파일 |
| `/etc/tashu/kafka.env` | Server B별 bind/advertised 주소와 cluster ID | Git 제외, `0640 root:root` |
| `tashu-kafka-data` | Kafka log와 KRaft metadata를 보존하는 Docker named volume | Git 제외, 삭제 시 데이터 소실 |

Kafka cluster ID는 인증 비밀번호가 아니지만 서버별 영속 데이터와 짝을 이루므로 서버 전용 파일로 관리한다. 기존 volume을 유지한 채 cluster ID를 바꾸면 기동하지 못할 수 있다.

## listener와 방화벽

- broker listener `9092`: Server B 사설 IP에만 bind하고 Server A 사설 IP에서만 UFW로 허용한다.
- controller listener `9093`: `127.0.0.1`에만 bind한다.
- Compose는 `network_mode: host`를 사용한다. Docker port publishing이 UFW 규칙을 우회하는 상황을 피하고 host UFW가 9092 접근을 직접 제어하게 한다.
- 현재는 두 SSAFY 서버의 사설망 안에서만 `PLAINTEXT`를 사용하며 Kafka 자체 인증은 없다. 인터넷 공개, 다중 팀 공유 또는 신뢰할 수 없는 client가 필요해지면 SASL/SSL을 먼저 추가한다.

Server B UFW 허용 규칙은 실제 사설 IP를 확인한 뒤 다음 형태로 한 줄만 추가한다.

```bash
sudo ufw allow from <SERVER_A_PRIVATE_IP> to <SERVER_B_PRIVATE_IP> port 9092 proto tcp comment 'Kafka from Server A'
```

외부 `Anywhere` 대상으로 9092를 허용하지 않는다.

## 자원과 보존 정책

- container: CPU 최대 1.5개, memory 최대 2GiB
- JVM heap: 512MiB 시작, 최대 1GiB
- Kafka log retention: 72시간
- log segment: 128MiB
- topic 자동 생성: 비활성화
- single broker 내부 topic replication factor/min ISR: 1

topic 자동 생성을 끈 이유는 topic 이름 오타가 새 topic으로 조용히 생성되는 것을 막기 위해서다. 업무 topic은 event 단위와 schema 합의 후 명시적으로 생성한다.

## 설치와 검증 순서

```bash
sudo install -d -o root -g root -m 0755 /opt/tashu/kafka
sudo cp -a infra/kafka/. /opt/tashu/kafka/
sudo /opt/tashu/kafka/scripts/bootstrap-env.sh
sudo docker compose --env-file /etc/tashu/kafka.env -f /opt/tashu/kafka/compose.yml config
sudo docker compose --env-file /etc/tashu/kafka.env -f /opt/tashu/kafka/compose.yml up -d
sudo /opt/tashu/kafka/scripts/smoke-test.sh
sudo /opt/tashu/kafka/scripts/ensure-topics.sh
```

기동 뒤에는 다음을 확인한다.

```bash
sudo docker compose --env-file /etc/tashu/kafka.env -f /opt/tashu/kafka/compose.yml ps
sudo ss -lntp
sudo ufw status numbered
```

정상 결과는 `tashu-kafka`가 `healthy`, 9092가 Server B 사설 IP에만 LISTEN, 9093이 loopback에만 LISTEN, 임시 메시지 왕복 시험 성공이다.

## 2026-09-10 운영 검증

- Server B에서 `tashu-kafka` health가 `healthy`로 유지됐다.
- 임시 topic의 create → produce → consume → delete smoke test가 성공했다.
- Kafka container 재시작 후 health가 복구되고 smoke test가 다시 성공했다.
- 재시작 전에 저장한 임시 메시지를 재시작 후 소비해 named volume 영속성을 확인했다.
- 9092는 Server B 사설 주소, 9093은 loopback에만 LISTEN했다.
- UFW는 Server A에서 Server B 9092로 들어오는 연결만 허용했다.
- Server A에서 9092 TCP 연결이 성공했고 기존 Collector는 중단 없이 최신 snapshot을 계속 저장했다.
- Server A의 일회성 공식 Kafka client가 broker metadata와 지원 API를 읽어 advertised listener까지 검증했다. 검증 container와 image cache는 이후 제거했다.
- Jenkins Controller·Build Agent와 관측성 container, 실패 systemd unit 0개 상태를 유지했다.

## 업무 topic 계약

2026-09-11 데이터 파트의 로컬 Collector 검증 결과를 기준으로 다음 계약을 확정했다.

| 항목 | 값 |
| --- | --- |
| topic | `tashu.station-availability.v1` |
| record 단위 | 대여소 한 곳의 현재 상태 event |
| record key | `station_id` |
| snapshot 묶음 | 같은 수집 회차의 event가 동일한 `snapshot_id` 사용 |
| partitions | 3 |
| replication factor | 1 |
| retention | 72시간 |
| security protocol | `PLAINTEXT` |
| SASL·SSL·Kafka ACL | 현재 미사용, Server A 전용 UFW 규칙으로 접근 제한 |

`replication factor=1`은 단일 broker 학습 구성이므로 복제본이나 고가용성을 제공하지 않는다. Kafka가 중단되면 Collector가 local spool에 event를 보존하고 복구 후 FIFO로 replay한다. Parquet 저장은 Kafka 성공 여부와 독립적으로 계속한다.

운영 topic 이름에 `snapshot`을 사용하지 않는 이유는 Kafka record 한 건이 전체 snapshot이 아니라 대여소 한 곳의 상태이기 때문이다. `snapshot_id`가 같은 수집 회차의 record들을 논리적으로 묶는다.

## 2026-09-11 운영 topic 검증

- `tashu.station-availability.v1`을 partition 3개, replication factor 1로 명시적으로 생성했다.
- topic별 `retention.ms=259200000`, `cleanup.policy=delete`를 적용했다.
- partition 0~2의 leader·replica·ISR이 모두 broker 1로 정상 등록됐다.
- Kafka 컨테이너 재시작 후 동일 TopicId와 설정이 named volume에 유지됐다.
- Server A에서 9092 TCP 재연결에 성공했고 기존 Collector의 Parquet 수집은 계속 정상 동작했다.

## 중지와 복구

```bash
sudo docker compose --env-file /etc/tashu/kafka.env -f /opt/tashu/kafka/compose.yml stop kafka
sudo docker compose --env-file /etc/tashu/kafka.env -f /opt/tashu/kafka/compose.yml start kafka
```

컨테이너를 다시 만들어도 named volume은 유지된다. `docker compose down -v`는 Kafka 데이터와 metadata를 삭제하므로 장애 시험이나 일반 재배포에 사용하지 않는다.

## 공식 자료

- [Apache Kafka Downloads](https://kafka.apache.org/community/downloads/)
- [Apache Kafka Docker Quickstart](https://kafka.apache.org/quickstart/)
- [Kafka 4.3 Broker Configs](https://kafka.apache.org/43/configuration/broker-configs/)
- [Kafka Listener Configuration](https://kafka.apache.org/43/security/listener-configuration/)
