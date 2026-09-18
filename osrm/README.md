# OSRM runtime

Server A에서 도보, 일반 자전거, 오르막 회피 경로 엔진 3개를 실행한다. 외부 인터넷에는
OSRM port를 공개하지 않고 Backend와 같은 `tashu-app` Docker network로만 연결한다.

## 파일 역할

| 경로 | 역할 | Git/Secret |
| --- | --- | --- |
| `compose.yml` | OSRM 3개 컨테이너, loopback port, 내부 network와 자원 제한 | Git 추적, Secret 없음 |
| `data/foot` | 도보 MLD routing dataset | Git 추적, Secret 없음 |
| `data/bicycle` | 일반 자전거 MLD routing dataset | Git 추적, Secret 없음 |
| `data/uphill` | 오르막 회피 자전거 MLD routing dataset | Git 추적, Secret 없음 |
| `osrm-uphill/dem` | Backend가 경로 좌표의 고도를 읽는 DEM과 metadata | Git 추적, Secret 없음 |
| `scripts/deploy.sh` | dataset 사전 검증, 컨테이너 시작과 실제 경로 응답 확인 | Git 추적, Secret 없음 |
| `/opt/tashu/osrm` | Server A 운영 설치 경로 | 서버 전용, Secret 없음 |

`/data/map.osrm`은 단일 파일이 아니라 `map.osrm.*` dataset의 기준 이름이다. 배포 스크립트는
세 dataset을 OSRM `--trial`로 실제 로드한 뒤에만 상시 컨테이너를 시작한다.

## 연결 구조

```text
tashu-backend-staging
        │ Docker network: tashu-app
        ├── osrm-foot:5000
        ├── osrm-bicycle:5000
        └── osrm-uphill:5000

Server A loopback 점검 port: 5000 / 5001 / 5002
Backend DEM mount: /opt/tashu/osrm/osrm-uphill/dem -> /app/dem:ro
```

## 배포

저장소의 `osrm/` 전체를 Server A `/opt/tashu/osrm`에 배치한 후 실행한다.

```bash
sudo /opt/tashu/osrm/scripts/deploy.sh
```

스크립트는 고정 image `ghcr.io/project-osrm/osrm-backend:v5.27.1`을 pull하고, dataset 3개를
상시 실행과 같은 OSRM 버전으로 검증한다. 성공 후 실제 대전 좌표 경로 응답의 `code=Ok`까지
확인한다.

## 상태 확인

```bash
cd /opt/tashu/osrm
sudo docker compose ps
curl --fail 'http://127.0.0.1:5000/route/v1/driving/127.3845,36.3504;127.4000,36.3600?overview=false'
curl --fail 'http://127.0.0.1:5001/route/v1/driving/127.3845,36.3504;127.4000,36.3600?overview=false'
curl --fail 'http://127.0.0.1:5002/route/v1/driving/127.3845,36.3504;127.4000,36.3600?overview=false'
```

정상 결과는 컨테이너 3개가 `Up`이고 세 응답에 모두 `"code":"Ok"`가 포함되는 것이다.
host port는 `127.0.0.1`에만 bind하므로 UFW에 OSRM port를 추가하지 않는다.

## 중지와 복구

```bash
cd /opt/tashu/osrm
sudo docker compose down
```

이 명령은 컨테이너와 OSRM 전용 network 연결만 제거한다. Git에서 받은 dataset과 DEM은
`/opt/tashu/osrm`에 남는다. 이전 설치로 복구할 때는 `/srv/tashu/backups/`의 OSRM directory를
되돌린 뒤 `scripts/deploy.sh`를 다시 실행한다.
