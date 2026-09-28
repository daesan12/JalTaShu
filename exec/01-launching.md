# 잘타슈 빌드 및 배포 가이드

## 1. 시스템 구성

### 1.1 서비스 배치

| 구분 | 실행 위치 | 역할 |
| --- | --- | --- |
| Server A | 운영 서버 | Nginx, Frontend, Backend, MySQL, Redis, OSRM, Collector |
| Server B | 데이터/CI 서버 | Jenkins, Kafka, Spark, AI Serving, Prometheus, Loki, Grafana |
| AWS ECR | 외부 서비스 | Frontend, Backend, AI Docker image 저장 |
| AWS S3 | 외부 서비스 | 신고 사진, AI 모델, 실시간 Parquet 장기 보관 |

공개 서비스 도메인은 `https://j15b103.p.ssafy.io`이며, 운영 Frontend와 Backend는 Server A에서 Blue/Green 두 slot으로 실행된다.

### 1.2 주요 제품과 버전

| 영역 | 제품/런타임 | 버전 및 설정 |
| --- | --- | --- |
| JVM | Eclipse Temurin JDK/JRE | `21.0.12_8`, Backend Docker build/runtime |
| Backend | Java / Spring Boot | Java `21`, Spring Boot `4.1.1` |
| WAS | Embedded Apache Tomcat | `11.0.24`, Spring Boot 의존성 관리 |
| Backend build | Gradle Wrapper | `9.7.1` |
| Frontend build | Node.js | `22.23.2` |
| Frontend | React / Vite / TypeScript | React `19.2.8`, Vite `8.2.2`, TypeScript `6.0.2` 계열 |
| Frontend 웹 서버 | nginx-unprivileged | `1.28.0-alpine`, 컨테이너 내부 `8080` |
| 외부 웹 서버 | Nginx + Certbot | 호스트 패키지 버전은 저장소에서 고정하지 않음. 설치 서버에서 `nginx -v`로 확인 |
| Android | Capacitor / Android Gradle Plugin | Capacitor `8.5.2`, AGP `8.13.0`, Gradle `8.14.3`, compile/target SDK `36`, min SDK `26` |
| AI/Collector | Python | Docker 기준 `3.12.14` |
| AI | LightGBM / pandas / NumPy | LightGBM `4.7.0`, pandas `3.0.5`, NumPy `2.4.6` |
| RDBMS | MySQL | 운영 `8.4.11`, 로컬 Compose `8.0` |
| Cache | Redis | `8.8.1`, AOF `everysec`, 비밀번호 인증 |
| Message broker | Apache Kafka | `4.3.1`, KRaft 단일 broker |
| Data processing | Apache Spark | `4.1.3`, Scala `2.13`, Java `21`, Python `3` |
| Routing | OSRM Backend | `5.27.1`, MLD 알고리즘 |
| CI/CD | Jenkins | `2.568.3-jdk21` Controller, 별도 Docker Build Agent |
| Monitoring | Prometheus / Grafana / Loki | Prometheus `3.13.1`, Grafana `13.2.1`, Loki `3.7.5` |
| Host metrics/log shipper | node_exporter / Alloy | node_exporter `1.12.1`, Alloy `1.19.2` |

IDE는 프로젝트 메타데이터 기준 IntelliJ IDEA `2023.3.8`, Project SDK `azul-21`을 사용했다. IDE 제품 버전은 빌드 결과에 관여하지 않으며, 명령행 빌드에서는 반드시 `JAVA_HOME`과 `java -version`이 JDK 21을 가리켜야 한다.

### 1.3 주요 포트와 URL

| 대상 | 주소/포트 | 공개 여부 |
| --- | --- | --- |
| Production Frontend Blue/Green | `127.0.0.1:28080`, `127.0.0.1:28082` | Nginx를 통해서만 공개 |
| Production Backend Blue/Green | `127.0.0.1:28081`, `127.0.0.1:28083` | Nginx를 통해서만 공개 |
| Staging Frontend | `127.0.0.1:18080` | `/staging/`으로 프록시 |
| Staging Backend | `127.0.0.1:18081` | `/staging-api/`, `/staging-auth/`로 프록시 |
| MySQL | `3306` | loopback 및 허용된 사설망만 사용 |
| Redis | `6379` | 사설망 및 Docker network만 사용 |
| OSRM foot/bicycle/uphill | host `5000/5001/5002` | loopback만 사용, 컨테이너 간에는 모두 `5000` |
| Kafka broker/controller | `9092` / `127.0.0.1:9093` | `9092`는 Server A에서만 허용 |
| Jenkins | `127.0.0.1:8080` | SSH tunnel로 관리 |
| Grafana / Prometheus / Loki | `127.0.0.1:3000`, `127.0.0.1:9090`, 사설 `3100` | 관리 UI는 SSH tunnel 사용 |

## 2. 소스 clone 및 로컬 빌드

### 2.1 소스 받기

```bash
git clone https://lab.ssafy.com/s15-bigdata-dist-sub1/S15P21B103.git
cd S15P21B103
git switch develop
git pull --ff-only origin develop
```

### 2.2 Backend

필수 조건은 JDK 21과 Docker Compose v2이다. Gradle은 별도 설치하지 않고 Wrapper를 사용한다.

```powershell
Copy-Item backend/good-tashu/backend-local.env.example `
  backend/good-tashu/backend-local.env

# backend-local.env의 실제 값을 입력한 뒤 MySQL/Redis 실행
docker compose `
  --env-file backend/good-tashu/backend-local.env `
  --file docker-compose-local.yml up -d mysql redis

cd backend/good-tashu
./gradlew.bat clean test bootJar
./gradlew.bat bootRun
```

Linux/macOS에서는 `./gradlew`를 사용한다. 생성 JAR은 `backend/good-tashu/build/libs/`에 위치하며 기본 Backend 포트는 `8080`이다.

`backend-local.env.example`에 없는 다음 JWT 값도 로컬 비공개 파일에 추가해야 한다.

```dotenv
JWT_SECRET_BASE64=<충분히 긴 Base64 서명키>
JWT_ACCESS_TOKEN_EXPIRES=<access token 만료시간>
JWT_REFRESH_TOKEN_EXPIRES=<refresh token 만료시간>
JWT_SECURE=false
```

### 2.3 Frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm test
npm run lint
npm run build
npm run dev
```

- 개발 서버 기본 주소: `http://localhost:5173`
- 빌드 산출물: `frontend/dist/`
- Backend 없이 화면만 개발할 때는 `VITE_ENABLE_MSW=true`를 사용한다.
- 실제 API와 연동할 때는 `VITE_ENABLE_MSW=false`로 빌드한다.

Android debug APK 빌드:

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK 경로는 `frontend/android/app/build/outputs/apk/debug/app-debug.apk`이다. 저장소의 `shared-debug.keystore`는 debug 전용이며 Play Store release signing에 사용하면 안 된다.

### 2.4 AI Serving

```powershell
cd tashu-ai
py -3.12 -m venv .venv
./.venv/Scripts/Activate.ps1
python -m pip install -r requirements.txt
Copy-Item dev/.env.example dev/.env
python -m pytest tests/ -q
python -m src.serve --env-file dev/.env --once
```

운영 AI는 `lgbm_lambda.joblib`, `lgbm_mu.joblib`, `station_profile.parquet` 세 파일이 필요하다. 운영에서는 S3에서 내려받은 파일의 SHA-256을 manifest와 대조한 후 read-only volume으로 mount한다.

### 2.5 Collector

```powershell
cd data-pipeline/collector
py -3.12 -m venv .venv
./.venv/Scripts/Activate.ps1
python -m pip install -r requirements.txt
python -m unittest discover tests
```

실제 공공데이터 API를 한 번만 확인할 때는 Secret을 프로세스 환경변수로 주입하고 `python collect.py --once`를 실행한다. `.env.example`은 변수 목록 예시이며 Collector가 자동으로 읽지 않는다.

### 2.6 Docker image 직접 빌드

```bash
# Backend runtime image
docker build \
  --file backend/good-tashu/Dockerfile \
  --tag tashu/backend:local \
  backend/good-tashu

# Production Frontend runtime image
docker build \
  --file infra/runtime/frontend/Dockerfile \
  --build-arg FRONTEND_API_PATH=/api \
  --build-arg FRONTEND_LOGIN_PATH=/auth \
  --build-arg FRONTEND_BASE_PATH=/ \
  --build-arg FRONTEND_MAP_CLIENT_ID=<NAVER_MAP_CLIENT_ID> \
  --build-arg FRONTEND_ENABLE_MSW=false \
  --tag tashu/frontend:local \
  .

# AI test/runtime image
docker build \
  --file infra/jenkins/pipeline/ai-serving.Dockerfile \
  --tag tashu/ai:local \
  tashu-ai
```

## 3. 빌드 및 실행 환경 변수

### 3.1 Frontend build-time 변수

Vite 변수는 정적 번들에 포함되므로 image 실행 후 변경할 수 없다. 환경별로 image를 다시 빌드해야 한다.

| Vite 변수 | Docker build arg | Production | Staging | 설명 |
| --- | --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `FRONTEND_API_PATH` | `/api` | `/staging-api` | Backend API prefix |
| `VITE_AUTH_BASE_URL` | `FRONTEND_LOGIN_PATH` | `/auth` | `/staging-auth` | OAuth 시작 prefix |
| `VITE_BASE_PATH` | `FRONTEND_BASE_PATH` | `/` | `/staging/` | Vite/React Router base path |
| `VITE_NAVER_MAP_CLIENT_ID` | `FRONTEND_MAP_CLIENT_ID` | Jenkins Credential | Jenkins Credential | Naver Dynamic Map Client ID |
| `VITE_ENABLE_MSW` | `FRONTEND_ENABLE_MSW` | `false` | `false` | Mock Service Worker 활성화 여부 |

### 3.2 Backend 변수

| 분류 | 변수 | 설명 |
| --- | --- | --- |
| MySQL | `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` | 배포용 DB 접속정보 |
| 로컬 MySQL | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | 로컬 Compose 및 `application.properties` 기본 설정 |
| Redis 인증 | `SPRING_DATA_REDIS_HOST`, `SPRING_DATA_REDIS_PORT`, `SPRING_DATA_REDIS_PASSWORD`, `SPRING_DATA_REDIS_DATABASE` | Refresh Token 등 일반 Redis 연결 |
| 실시간 대여소 | `TASHU_STATION_REDIS_HOST`, `TASHU_STATION_REDIS_PORT`, `TASHU_STATION_REDIS_PASSWORD`, `TASHU_STATION_REDIS_DATABASE` | Collector snapshot 조회, 운영 DB `0` |
| AI 예측 | `TASHU_PREDICTION_REDIS_HOST`, `TASHU_PREDICTION_REDIS_PORT`, `TASHU_PREDICTION_REDIS_PASSWORD`, `TASHU_PREDICTION_REDIS_DATABASE` | `pred:*` 조회, 운영 DB `2` |
| JWT | `JWT_SECRET_BASE64`, `JWT_ACCESS_TOKEN_EXPIRES`, `JWT_REFRESH_TOKEN_EXPIRES`, `JWT_SECURE` | 서명키, 만료시간, Secure cookie 여부 |
| Kakao OAuth | `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `FRONTEND_OAUTH_SUCCESS_URL`, `FRONTEND_OAUTH_FAILURE_URL` | OAuth client 및 로그인 후 이동 URL |
| Kakao callback | `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_KAKAO_REDIRECT_URI` | production 전용 callback override |
| Naver Place | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 장소 검색 API 자격증명 |
| 사진 S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `S3_BUCKET` | `images/*` 전용 최소권한 IAM |
| 파일 업로드 | `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE`, `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` | 운영값 `5MB`, `6MB` |
| 관리자 초기화 | `ADMIN_BOOTSTRAP_ENABLED`, `ADMIN_BOOTSTRAP_ID`, `ADMIN_BOOTSTRAP_PASSWORD` | 최초 관리자 생성. 완료 후 비활성화 |
| OSRM | `OSRM_FOOT_BASE_URL`, `OSRM_BICYCLE_BASE_URL`, `OSRM_UPHILL_BASE_URL`, `OSRM_DEM_DIRECTORY` | 세 routing service와 DEM 경로 |
| Reverse proxy | `SERVER_FORWARD_HEADERS_STRATEGY=framework` | Nginx의 HTTPS forwarded header 반영 |
| Timezone | `TZ=Asia/Seoul` | 애플리케이션 컨테이너 시간대 |

Production Redis DB는 인증/실시간 상태 `0`, AI 예측 `2`를 사용한다. Staging 인증은 DB `1`을 사용하지만 실시간 대여소 조회는 DB `0`을 공유한다.

### 3.3 실시간 수집기 변수

대여소 Collector:

| 변수 | 기본값/설명 |
| --- | --- |
| `TASHU_API_KEY`, `TASHU_API_KEY_FALLBACK` | 공공데이터포털 primary/fallback key |
| `TASHU_INTERVAL_SECONDS` | `45`, 수집 간격 |
| `TASHU_WRITE_CSV` | `false`, Parquet 외 CSV 생성 여부 |
| `TASHU_DATA_DIR` | `data`, 저장 기준 경로 |
| `TASHU_KAFKA_ENABLED` | `false`, Kafka 발행 활성화 |
| `TASHU_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` |
| `TASHU_KAFKA_TOPIC` | `tashu.station-availability.v1` |
| `TASHU_KAFKA_CLIENT_ID` | `tashu-collector` |
| `TASHU_KAFKA_DELIVERY_TIMEOUT_SECONDS` | `10` |
| `TASHU_KAFKA_SPOOL_DIR` | 미전송 batch outbox 경로 |
| `TASHU_REDIS_ENABLED` | 운영에서 `true` |
| `TASHU_REDIS_HOST`, `TASHU_REDIS_PORT`, `TASHU_REDIS_DATABASE`, `TASHU_REDIS_PASSWORD` | Redis DB `0` 연결 |
| `TASHU_REDIS_LATEST_KEY` | `tashu:station-availability:latest:v1` |
| `TASHU_REDIS_LAST_KNOWN_KEY` | `tashu:station-availability:last-known:v1` |
| `TASHU_REDIS_TTL_SECONDS` | `180` |
| `DISCORD_WEBHOOK_URL`, `LOG_LEVEL` | 장애 알림 URL, 로그 레벨 |

날씨 Collector:

| 변수 | 기본값/설명 |
| --- | --- |
| `KMA_API_KEY` | 기상청 API 인증키 |
| `KMA_NX`, `KMA_NY` | 대전 대표 격자 `67`, `100` |
| `WEATHER_INTERVAL_SECONDS`, `WEATHER_RELEASE_MINUTE` | `300`, `40` |
| `WEATHER_DATA_DIR`, `WEATHER_HEALTH_PATH` | 데이터 및 health 파일 경로 |
| `WEATHER_KAFKA_ENABLED`, `WEATHER_KAFKA_BOOTSTRAP_SERVERS` | Kafka 사용 여부와 broker |
| `WEATHER_KAFKA_TOPIC`, `WEATHER_KAFKA_CLIENT_ID` | `tashu.weather-observation.v1`, `tashu-weather-collector` |
| `WEATHER_KAFKA_DELIVERY_TIMEOUT_SECONDS`, `WEATHER_KAFKA_SPOOL_DIR` | 전송 제한시간과 outbox |
| `WEATHER_REDIS_ENABLED`, `WEATHER_REDIS_HOST`, `WEATHER_REDIS_PORT`, `WEATHER_REDIS_DATABASE`, `WEATHER_REDIS_PASSWORD` | 최신 날씨 Redis DB `0` 연결 |
| `WEATHER_REDIS_LATEST_KEY`, `WEATHER_REDIS_TTL_SECONDS` | `tashu:weather:latest:v1`, `3600` |

### 3.4 Spark Streaming과 AI 변수

| 구분 | 변수 | 설명 |
| --- | --- | --- |
| Spark/Kafka | `TASHU_KAFKA_BOOTSTRAP_SERVERS`, `TASHU_STATION_TOPIC`, `TASHU_WEATHER_TOPIC` | 입력 broker 및 topic |
| Spark 상태 | `TASHU_STREAM_CHECKPOINT_ROOT`, `TASHU_STREAM_DEAD_LETTER_ROOT` | checkpoint와 잘못된 event 저장 경로 |
| Spark 처리 | `TASHU_STREAM_TRIGGER_SECONDS`, `TASHU_STREAM_STARTING_OFFSETS`, `TASHU_STREAM_MAX_OFFSETS_PER_TRIGGER` | micro-batch 설정 |
| Spark/MySQL | `TASHU_DATA_DB_JDBC_URL`, `TASHU_DATA_DB_USER`, `TASHU_DATA_DB_PASSWORD`, `TASHU_DATA_DB_DRIVER` | `tashu_data_writer` 연결 |
| AI/MySQL | `TASHU_AI_DB_HOST`, `TASHU_AI_DB_PORT`, `TASHU_AI_DB_NAME`, `TASHU_AI_DB_USER`, `TASHU_AI_DB_PASSWORD` | `tashu_ai_reader` 연결 |
| AI/Redis | `TASHU_AI_REDIS_HOST`, `TASHU_AI_REDIS_PORT`, `TASHU_AI_REDIS_DB`, `TASHU_AI_REDIS_PASSWORD` | 예측값 기록용 Redis DB `2` |

### 3.5 배포 orchestration 변수

| 변수 | 사용 위치 |
| --- | --- |
| `FRONTEND_IMAGE`, `BACKEND_IMAGE`, `AI_SERVING_IMAGE` | 이미 pull한 immutable ECR image URI |
| `SLOT`, `FRONTEND_HOST_PORT`, `BACKEND_HOST_PORT` | production Blue/Green slot 선택 |
| `BACKEND_ENV_FILE` | Backend 최종 runtime env 경로 |
| `TASHU_OSRM_DEM_DIR` | 호스트 DEM 디렉터리 |
| `AI_DB_ENV_FILE`, `AI_REDIS_ENV_FILE`, `AI_MODEL_DIR` | AI env 및 모델 mount 경로 |
| `KAFKA_CLUSTER_ID`, `KAFKA_BIND_HOST`, `KAFKA_ADVERTISED_HOST` | Kafka KRaft 및 사설 listener |
| `REDIS_ENV_FILE`, `REDIS_PRIVATE_BIND_ADDRESS` | Redis Secret 파일 및 사설 bind 주소 |
| `SERVER_A_PRIVATE_IP`, `SERVER_B_PRIVATE_IP` | 관측/방화벽용 서버 사설 주소 |

## 4. 배포 절차

### 4.1 최초 서버 준비 순서

1. Server A와 Server B에 Docker Engine, Docker Compose v2, Git, AWS CLI v2를 설치한다.
2. Server A에 외부 Nginx와 Certbot을 설치하고 TLS 인증서를 발급한다.
3. Server A에서 `tashu-app` Docker network를 만들고 MySQL, Redis, OSRM을 순서대로 실행한다.
4. DB/Redis/외부 API Secret 파일을 `/etc/tashu/...` 아래에 생성하고 `root:root`, mode `0600`으로 제한한다.
5. Server B에서 Kafka와 Spark를 실행하고 Server A↔B 사설 IP에만 UFW 규칙을 허용한다.
6. Jenkins Controller/Agent를 실행하고 GitLab, ECR, Naver Map, 배포 SSH Credential을 등록한다.
7. Nginx 설정 `infra/nginx/tashu.conf`를 설치하고 `nginx -t` 후 reload한다.

각 인프라의 최초 설치 명령은 다음 문서를 기준으로 한다.

- `infra/mysql/README.md`
- `infra/redis/README.md`
- `infra/kafka/README.md`
- `infra/spark/README.md`
- `osrm/README.md`
- `infra/jenkins/README.md`
- `infra/nginx/README.md`
- `infra/observability/README.md`

### 4.2 Jenkins 자동 배포

모든 브랜치에서 Collector, Frontend, AI, Backend 검증을 실행한다.

`develop` 브랜치:

1. Frontend, Backend, AI image를 빌드한다.
2. 12자리 Git SHA를 tag로 사용해 private ECR의 `tashu/frontend`, `tashu/backend`, `tashu/ai`에 push한다.
3. Server A staging Frontend와 Backend를 SSH 강제 명령으로 교체한다.
4. Docker health와 HTTP health가 실패하면 이전 image로 복구한다.
5. AI는 Jenkins parameter `DEPLOY_AI_SERVING=true`일 때만 Server B에 배포한다.

`main` 브랜치:

1. Frontend/Backend image를 `prod-<12자리 SHA>` tag로 ECR에 push한다.
2. 현재 비활성 Blue/Green slot에 image를 배포한다.
3. 내부 health check 통과 후 Jenkins가 최대 15분 동안 운영 전환 승인을 기다린다.
4. `Proceed` 승인 시 Nginx의 Frontend/Backend upstream을 같은 slot으로 전환한다.
5. 공개 `/health`와 `/api/actuator/health`를 확인하고, 실패하면 직전 slot으로 자동 롤백한다.

### 4.3 수동 staging 배포

Backend runtime 환경파일 생성:

```bash
sudo /opt/tashu/infra/runtime/backend/scripts/render-staging-env.sh
```

Frontend/Backend image pull 및 배포:

```bash
sudo /opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh \
  tashu/frontend <12자리-Git-SHA>
sudo /opt/tashu/infra/runtime/frontend/scripts/deploy-staging.sh \
  <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tashu/frontend:<12자리-Git-SHA>

sudo /opt/tashu/infra/aws/ecr/scripts/pull-runtime-image.sh \
  tashu/backend <12자리-Git-SHA>
sudo /opt/tashu/infra/runtime/backend/scripts/deploy-staging.sh \
  <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tashu/backend:<12자리-Git-SHA>
```

검증:

```bash
curl --fail http://127.0.0.1:18080/health
curl --fail http://127.0.0.1:18081/api/actuator/health
curl --fail https://j15b103.p.ssafy.io/staging/
curl --fail https://j15b103.p.ssafy.io/staging-api/actuator/health
```

### 4.4 Production 확인과 롤백

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
sudo cat /var/lib/tashu-production/active-slot
sudo cat /var/lib/tashu-production/active-sha
curl --fail https://j15b103.p.ssafy.io/health
curl --fail https://j15b103.p.ssafy.io/
curl --fail https://j15b103.p.ssafy.io/api/actuator/health
```

직전 slot이 healthy인 경우 수동 롤백:

```bash
sudo /opt/tashu/infra/runtime/production/scripts/jenkins-production-deploy.sh rollback
```

## 5. 배포 시 특이사항

1. **Secret을 image나 Git에 포함하지 않는다.** 운영 Secret은 `/etc/tashu` 아래 서버 전용 파일이나 Jenkins Credential로만 주입한다.
2. **`latest` tag를 사용하지 않는다.** Staging은 `<12자리 Git SHA>`, production은 `prod-<12자리 Git SHA>` tag를 사용한다. ECR repository는 tag immutable 설정을 사용한다.
3. **Blue/Green은 고가용성 구성이 아니다.** 두 slot 모두 Server A 한 대에서 실행되므로 서버 장애 자체를 견디지는 못한다.
4. **Blue/Green 두 Backend가 같은 production DB와 Redis DB 0을 공유한다.** DB migration은 구버전과 신버전에서 동시에 동작하는 하위 호환 방식이어야 한다.
5. **현재 Backend는 `spring.jpa.hibernate.ddl-auto=update`이다.** 파괴적인 스키마 변경 전에는 반드시 MySQL backup/restore를 검증하고, 운영 안정화 후 `validate` 전환을 검토한다.
6. **Flyway migration version은 중복되면 안 된다.** 같은 `V3__...sql` 파일이 두 개 있으면 시작 단계에서 실패할 수 있으므로 병합 전에 version을 재정렬한다.
7. **Frontend 환경 변수는 build-time 값이다.** Production과 staging은 base path가 다르므로 같은 frontend image를 재사용하지 않는다.
8. **OAuth callback을 환경별로 분리한다.** Kakao Console에는 staging과 production callback URI를 모두 등록해야 한다.
9. **OSRM은 세 프로필의 사전 처리 데이터가 필요하다.** `osrm/data/foot`, `osrm/data/bicycle`, `osrm/data/uphill`에 `map.osrm*` 파일이 없으면 컨테이너가 정상 기동하지 않는다.
10. **DEM은 read-only mount한다.** Server A의 `/opt/tashu/osrm/osrm-uphill/dem`을 Backend `/app/dem`으로 연결한다.
11. **Firebase key는 Git에서 제외된다.** Backend는 `firebase/fcm-key.json`을 classpath에서 찾으며, 파일이 없으면 FCM 초기화 실패 로그가 남고 push 알림을 보낼 수 없다. 실제 서비스 계정 JSON은 안전한 배포 방식으로 제공해야 한다.
12. **관리자 bootstrap은 일회성이다.** 운영에서 활성화할 때 비밀번호는 12자 이상으로 설정하고 계정 생성 확인 후 `ADMIN_BOOTSTRAP_ENABLED=false`로 되돌린다.
13. **Redis DB 번호를 섞지 않는다.** Production 인증/실시간은 `0`, staging 인증은 `1`, AI 예측은 `2`이다.
14. **Kafka/Spark/MySQL 시간 기준은 UTC이다.** 사용자 표시 및 AI 피처에서는 `Asia/Seoul`로 변환한다.
15. **운영 중 volume 삭제 명령을 사용하지 않는다.** `docker compose down -v`는 MySQL, Redis, Kafka, Jenkins, 모니터링 데이터를 삭제할 수 있다.
16. **로컬 Gradle 실행 전 Java 버전을 확인한다.** Gradle 9.7.1은 Java 17 이상이 필요하고 본 프로젝트 toolchain은 Java 21이다.

## 6. DB 계정과 주요 외부 계정

### 6.1 MySQL 계정

| 계정 | DB | 권한/용도 | 비밀번호 보관 파일 |
| --- | --- | --- | --- |
| `root` | 전체 | 최초 DB/계정 생성 및 관리 | `/etc/tashu/mysql/root-password` |
| `tashu_prod_user` | `tashu_prod` | Production Backend DML 및 현재 필요한 제한 DDL | `/etc/tashu/mysql/prod-password` |
| `tashu_staging_user` | `tashu_staging` | Staging Backend DML 및 현재 필요한 제한 DDL | `/etc/tashu/mysql/staging-password` |
| `tashu_data_writer` | `tashu_data` | Spark의 SELECT/INSERT/UPDATE/DELETE | `/etc/tashu/mysql/data-writer-password` |
| `tashu_ai_reader` | `tashu_data` | AI Serving SELECT 전용 | `/etc/tashu/mysql/ai-reader-password` |
| `tashu_observer` | `tashu_prod`, `tashu_staging`, `tashu_data` | DBeaver 조회 전용 | `/etc/tashu/mysql/observer-password` |

MySQL은 인터넷에 공개하지 않는다. DBeaver는 SSH tunnel을 통해 Server A의 `127.0.0.1:3306`에 접속한다.

### 6.2 외부 서비스 및 운영 계정

| 계정/자격증명 | 용도 | 보관 위치 |
| --- | --- | --- |
| Kakao OAuth client | 사용자 로그인 | `/etc/tashu/backend-staging/oauth.env` |
| Naver Place API client | 장소 검색 | `/etc/tashu/backend-common/naver-place.env` |
| Naver Map Client ID | 브라우저 지도 SDK | Jenkins `naver-map-client-id` Credential |
| AWS photo S3 IAM | 신고 사진 `images/*` 접근 | `/etc/tashu/backend-common/photo-s3.env` |
| AWS Jenkins ECR Push IAM | CI image push | Jenkins `aws-ecr-push` Credential |
| AWS runtime ECR Pull IAM | 서버별 image pull | `/etc/tashu/ecr-pull/credentials` |
| AWS AI model reader IAM | AI 모델 S3 read-only | `/etc/tashu/ai-serving/aws-model-reader.env` |
| Firebase service account | FCM push | Git 제외 파일/Secret mount, `firebase/fcm-key.json` |
| GitLab Deploy Token | Jenkins source checkout | Jenkins `gitlab-readonly` Credential |
| Jenkins deploy SSH key | Server A/B 제한 명령 실행 | `/etc/tashu/jenkins/` 아래 key 파일 |

## 7. 주요 property, Secret, ERD/DDL 파일 목록

### 7.1 Git으로 관리하는 설정 파일

| 파일 | 역할 |
| --- | --- |
| `backend/good-tashu/src/main/resources/application.properties` | Spring, DB, Redis, OAuth, JWT, OSRM, Flyway, Actuator 설정 |
| `backend/good-tashu/backend-local.env.example` | Backend 로컬 환경 변수 예시 |
| `frontend/.env.example` | Frontend Vite 환경 변수 예시 |
| `tashu-ai/dev/.env.example` | AI 로컬 MySQL/Redis 환경 변수 예시 |
| `data-pipeline/collector/.env.example` | 대여소 Collector 변수 목록 |
| `data-pipeline/weather-collector/.env.example` | 날씨 Collector 변수 목록 |
| `data-pipeline/streaming/.env.example` | Kafka→MySQL Spark job 변수 목록 |
| `docker-compose-local.yml` | 로컬 MySQL/Redis 실행 설정 |
| `infra/runtime/backend/compose.staging.yml` | Staging Backend runtime |
| `infra/runtime/frontend/compose.staging.yml` | Staging Frontend runtime |
| `infra/runtime/production/compose.yml` | Production Blue/Green runtime |
| `infra/runtime/ai-serving/compose.yml` | AI Serving runtime |
| `infra/mysql/compose.yml` | 운영 MySQL 이미지, volume, network |
| `infra/redis/compose.yml` | 운영 Redis 이미지, AOF, 인증 |
| `infra/kafka/compose.yml` | Kafka KRaft broker/controller |
| `infra/spark/compose.yml` | Spark Master/Worker/History Server |
| `osrm/compose.yml` | OSRM foot/bicycle/uphill 세 서비스 |
| `infra/nginx/tashu.conf` | TLS, production/staging reverse proxy |
| `Jenkinsfile` | CI, ECR push, staging 및 production CD |

### 7.2 Git에 넣지 않는 실제 Secret/property 파일

| 서버 파일 | 내용 |
| --- | --- |
| `backend/good-tashu/backend-local.env` | 개발자 로컬 Backend Secret |
| `frontend/.env.local` | 개발자 로컬 Frontend 설정 |
| `/etc/tashu/backend-staging/oauth.env` | Kakao 및 staging OAuth URL |
| `/etc/tashu/backend-staging/jwt.env` | JWT 서명키/만료시간/cookie 보안 설정 |
| `/etc/tashu/backend-staging/runtime.env` | 렌더링된 staging Backend 최종 환경 |
| `/etc/tashu/backend-production/runtime.env` | 렌더링된 production Backend 최종 환경 |
| `/etc/tashu/backend-common/naver-place.env` | Naver Place client Secret |
| `/etc/tashu/backend-common/photo-s3.env` | 사진 S3 IAM과 bucket |
| `/etc/tashu/backend-common/admin-bootstrap.env` | 운영 관리자 초기 계정 |
| `/etc/tashu/redis/runtime.env` | `REDIS_PASSWORD` |
| `/etc/tashu/streaming/mysql-data-writer.env` | Spark MySQL writer 접속정보 |
| `/etc/tashu/ai-serving/mysql-reader.env` | AI MySQL reader 접속정보 |
| `/etc/tashu/ai-serving/redis.env` | AI Redis DB 2 접속정보 |
| `/etc/tashu/ai-serving/aws-model-reader.env` | AI 모델 S3 read-only IAM |
| `/etc/tashu/ecr-pull/credentials` | 서버별 ECR Pull IAM |
| `/etc/tashu/kafka.env` | Kafka bind/advertised host 및 cluster ID |
| `/etc/tashu/jenkins/*` | Jenkins 관리자, GitLab, ECR, SSH Credential 원본 |
| `/etc/tashu-observability/grafana-admin-password` | Grafana 관리자 비밀번호 |

### 7.3 ERD 및 DB 스키마 관련 파일

| 파일/경로 | 역할 |
| --- | --- |
| `backend/good-tashu/src/main/java/**/domain/*Entity.java` | JPA Entity, 애플리케이션 ERD의 기준 모델 |
| `backend/good-tashu/src/main/resources/db/migration/*.sql` | Flyway schema/data migration |
| `infra/mysql/schema/tashu-data.sql` | 실시간 `station_availability`, `weather_observation` DDL과 인덱스 |
| `infra/mysql/conf.d/tashu.cnf` | MySQL charset, timezone, connection/InnoDB 설정 |
| `infra/mysql/scripts/bootstrap-databases.sh` | Production/Staging DB와 계정 생성 |
| `infra/mysql/scripts/bootstrap-data-database.sh` | Data DB 및 writer/reader/observer 계정 생성 |
| `infra/mysql/scripts/bootstrap-data-tables.sh` | 실시간 DDL 반복 적용 |

ERD 이미지가 별도로 필요한 경우 위 JPA Entity와 SQL migration을 기준으로 생성하며, 실제 운영 비밀번호나 접속 가능한 공인 주소는 ERD 문서에 포함하지 않는다.
