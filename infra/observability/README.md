# Observability baseline

두 SSAFY 서버의 CPU, RAM, 루트 디스크, Collector freshness와 서비스 로그를 Grafana에서 확인하는 구성이다. 알림(Alertmanager)은 알림 수신 채널이 확정된 뒤 별도 단계로 추가한다.

## 구성과 데이터 흐름

```text
Server A node_exporter :9100
             │ 사설망, Server B만 허용
             ▼
Server B Prometheus :9090 ──▶ Grafana :3000
       ▲                         ▲
       └─ Server B node_exporter ┘

Collector health.json → 30초 변환 → node_exporter textfile metrics
Collector journald → Alloy → Loki :3100 → Grafana Explore

관리 화면은 모두 127.0.0.1 bind → SSH tunnel로만 접속
```

- `node_exporter`는 서버 상태를 숫자로 노출한다. 데이터를 저장하지 않는다.
- `Prometheus`는 두 서버의 숫자를 15초마다 가져와 7일 또는 최대 2GB까지 보관한다.
- `tashu-collector-metrics`는 `health.json`을 Prometheus용 숫자로 30초마다 변환한다.
- `Alloy`는 Collector와 S3 sync의 journald 로그를 읽어 Loki로 전달한다.
- `Loki`는 서비스 로그를 7일간 저장한다.
- `Grafana`는 Prometheus의 숫자를 그래프로, Loki의 로그를 검색 화면으로 보여준다.

## 파일 역할

| 파일 | 실행 위치 | 역할 |
| --- | --- | --- |
| `node-exporter.compose.yml` | Server A | Server A 호스트 지표 제공 |
| `compose.yml` | Server B | Server B node_exporter, Prometheus, Loki, Grafana 실행 |
| `prometheus/prometheus.yml` | Server B | 두 서버를 15초마다 scrape |
| `scripts/tashu-collector-metrics` | Server A | `health.json`을 textfile metric으로 atomic 변환 |
| `systemd/tashu-collector-metrics.*` | Server A | freshness metric을 30초마다 갱신 |
| `alloy/config.alloy` | Server A | Collector·S3 sync journald 로그를 Loki로 전달 |
| `loki/loki.yml` | Server B | 단일 Loki와 7일 retention 구성 |
| `grafana/provisioning/datasources/prometheus.yml` | Server B | Prometheus datasource 자동 등록 |
| `grafana/provisioning/datasources/loki.yml` | Server B | Loki datasource 자동 등록 |
| `grafana/provisioning/dashboards/tashu.yml` | Server B | dashboard 파일 자동 로드 설정 |
| `grafana/dashboards/tashu-servers.json` | Server B | CPU·RAM·disk·UP 기본 dashboard |

## 네트워크와 Secret

- Grafana `3000`, Prometheus `9090`, Server B node_exporter `9100`은 Server B의 `127.0.0.1`에만 bind한다.
- Server A node_exporter `9100`은 Server A 사설 IP에 bind하고 UFW에서 Server B 사설 IP만 허용한다.
- Loki `3100`은 Server B 사설 IP에 bind하고 UFW에서 Server A 사설 IP만 허용한다. Loki 자체 인증 기능이 없으므로 이 네트워크 제한을 제거하면 안 된다.
- Alloy 관리 UI `12345`는 Server A의 `127.0.0.1`에만 bind한다.
- 인터넷에 새로운 관리 포트를 공개하지 않는다.
- Server B의 `/etc/tashu-observability/grafana-admin-password`는 Git에 저장하지 않는다.
- 비밀번호 파일은 `0640 root:root`로 둔다. 공식 Grafana 컨테이너는 UID 472, GID 0으로 실행되므로 root 그룹 읽기 권한이 있어야 Docker secret을 읽을 수 있다.

## Server A 배포

서버 전용 env 파일에는 공개해도 되는 bind 주소만 둔다.

```bash
sudo install -d -o root -g root -m 0755 /opt/tashu/observability /etc/tashu-observability
printf '%s\n' \
  'NODE_EXPORTER_LISTEN_ADDRESS=<SERVER_A_PRIVATE_IP>' \
  'LOKI_PUSH_URL=http://<SERVER_B_PRIVATE_IP>:3100/loki/api/v1/push' \
  | sudo tee /etc/tashu-observability/node-exporter.env >/dev/null
sudo chmod 0644 /etc/tashu-observability/node-exporter.env
```

Server B 한 대만 지표를 읽도록 허용한다.

```bash
sudo ufw allow from <SERVER_B_PRIVATE_IP> to <SERVER_A_PRIVATE_IP> port 9100 proto tcp comment 'Prometheus from Server B'
sudo docker compose --env-file /etc/tashu-observability/node-exporter.env -f /opt/tashu/observability/node-exporter.compose.yml up -d
```

freshness 변환기와 timer는 `/usr/local/sbin`, `/etc/systemd/system`에 설치하고 활성화한다. 스크립트는 Collector 파일을 읽기만 하며 `/var/lib/node_exporter/textfile_collector`에만 쓴다.

## Server B 배포

```bash
sudo install -d -o root -g root -m 0755 /opt/tashu/observability /etc/tashu-observability
printf '%s\n' \
  'SERVER_A_PRIVATE_IP=<SERVER_A_PRIVATE_IP>' \
  'SERVER_B_PRIVATE_IP=<SERVER_B_PRIVATE_IP>' \
  | sudo tee /etc/tashu-observability/observability.env >/dev/null
sudo sh -c 'umask 0027; openssl rand -base64 24 > /etc/tashu-observability/grafana-admin-password'
sudo ufw allow from <SERVER_A_PRIVATE_IP> to <SERVER_B_PRIVATE_IP> port 3100 proto tcp comment 'Loki from Server A'
sudo docker compose --env-file /etc/tashu-observability/observability.env -f /opt/tashu/observability/compose.yml up -d
```

이미 비밀번호 파일과 Grafana 데이터 볼륨이 있으면 비밀번호를 새로 생성하지 않는다. 초기화 뒤 비밀번호 파일을 바꿨다면 Grafana DB의 관리자 암호도 별도로 변경해야 한다.

## 확인 방법

```bash
sudo docker compose --env-file /etc/tashu-observability/observability.env -f /opt/tashu/observability/compose.yml ps
curl -fsS http://127.0.0.1:9090/-/ready
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://<SERVER_B_PRIVATE_IP>:3100/ready
sudo ss -lntp | grep -E '(:3000|:3100|:9090|:9100|:12345)\b'
```

정상이면 세 컨테이너가 `Up`, 두 HTTP 확인이 성공하고, Server B의 세 포트는 `127.0.0.1`에서만 LISTEN한다.

## Grafana 접속

Windows PowerShell에서 SSH tunnel을 유지한다.

```powershell
ssh -i $keyPath -L 3000:127.0.0.1:3000 ubuntu@<SERVER_B_DOMAIN>
```

브라우저에서 `http://localhost:3000`을 열고 `admin` 계정으로 로그인한다. 비밀번호는 Server B에서 직접 확인하며 채팅이나 문서에 붙여넣지 않는다.

```bash
sudo cat /etc/tashu-observability/grafana-admin-password
```

`Dashboards → Tashu → Tashu Servers`에서 두 서버의 CPU, 메모리, 루트 디스크, exporter 상태, Collector freshness와 최근 대여소 수를 볼 수 있다. `Explore → Loki`에서 `{service="tashu-collector"}`로 Collector 로그를 검색한다.

## 중지와 복구

설정과 시계열 데이터를 보존한 채 중지한다.

```bash
sudo docker compose --env-file /etc/tashu-observability/observability.env -f /opt/tashu/observability/compose.yml down
```

같은 `up -d` 명령으로 다시 시작한다. `down -v`는 Prometheus와 Grafana 볼륨을 삭제하므로 프로젝트 철거 전에는 사용하지 않는다. Server A의 허용 규칙을 제거할 때는 추가했던 주소와 동일하게 다음 명령을 사용한다.

```bash
sudo ufw delete allow from <SERVER_B_PRIVATE_IP> to <SERVER_A_PRIVATE_IP> port 9100 proto tcp
```

## 검증 기록

2026-09-08에 다음을 확인했다.

- Prometheus에서 `server-a`, `server-b`가 모두 `up=1`
- Server A exporter 중단 시 `server-a=0`, 재시작 뒤 `server-a=1`
- 전체 Compose 재시작 뒤 dashboard와 Docker volume 유지
- freshness metric에서 실제 최근 대여소 수와 마지막 성공 후 경과 시간 조회
- Alloy와 Loki 재시작 뒤에도 Collector 최근 로그 검색 성공
- Server A Collector와 S3 sync timer는 exporter 장애 중에도 active
- Server B 관리 UI는 loopback에만 bind하고, Loki는 Server A 사설 IP에만 UFW 허용
