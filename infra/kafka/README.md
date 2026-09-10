# Kafka single-broker KRaft baseline

Server B에 Apache Kafka 단일 broker를 KRaft combined mode로 실행한다. Collector와 Spark 사이의 장애 격리, backlog, replay를 학습하고 검증하기 위한 구성이다. broker와 controller가 한 컨테이너에 있으므로 고가용성 구성은 아니다.

공식 Apache Kafka `4.3.1` JVM Docker image를 고정해서 사용한다. 움직이는 `latest` tag는 사용하지 않는다.

## 파일과 서버 경로

| 경로 | 역할 | Git/Secret |
| --- | --- | --- |
| `infra/kafka/compose.yml` | broker·controller listener, 자원 제한, 보존 기간과 volume 정의 | Git 추적, Secret 없음 |
| `infra/kafka/scripts/bootstrap-env.sh` | Server B 사설 IP와 cluster ID를 서버 전용 환경파일로 생성 | Git 추적, Secret 없음 |
| `infra/kafka/scripts/smoke-test.sh` | 임시 topic을 만들고 한 메시지를 produce·consume한 뒤 삭제 | Git 추적, Secret 없음 |
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
```

기동 뒤에는 다음을 확인한다.

```bash
sudo docker compose --env-file /etc/tashu/kafka.env -f /opt/tashu/kafka/compose.yml ps
sudo ss -lntp
sudo ufw status numbered
```

정상 결과는 `tashu-kafka`가 `healthy`, 9092가 Server B 사설 IP에만 LISTEN, 9093이 loopback에만 LISTEN, 임시 메시지 왕복 시험 성공이다.

## 업무 topic 계약: 아직 미확정

기존 인프라 설계는 `station-availability.raw.v1` topic에 `station_id`를 key로 한 대여소별 event를 넣는다. 데이터 파트의 새 제안은 `tashu.station-snapshots.v1`이라는 snapshot 단위 topic이다. 두 방식은 메시지 크기, partition 활용과 중복 제거 기준이 다르므로 이름만 바꾸지 않는다.

결정 전에는 업무 topic을 생성하거나 Collector를 수정하지 않는다. 합의할 항목은 다음과 같다.

- 한 Kafka record가 대여소 한 곳인지 전체 snapshot인지
- record key가 `station_id`인지 `snapshot_id`인지
- 최소 schema와 `schema_version`
- 72시간 retention과 최대 record 크기
- DLQ topic 필요 시점

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
