# 외부 서비스 정보

이 문서는 타슈 프로젝트의 외부 서비스에 **어디서 가입·활용 신청을 하고, 발급한 정보를 어디에 설정하는지** 정리한다. 실제 API 키, 비밀번호, AWS Access Key, Firebase 서비스 계정 JSON은 이 문서나 Git에 넣지 않는다. 팀이 서비스별 계정과 권한을 준비하고, 비밀 값은 서버의 비공개 환경파일 또는 Jenkins Credential에 입력한다.

## 한눈에 보기

| 서비스 | 가입·발급 위치 | 프로젝트에서 쓰는 기능 | 필요한 설정 |
| --- | --- | --- | --- |
| Kakao Developers | [카카오디벨로퍼스](https://developers.kakao.com/) | 사용자 카카오 로그인 | 앱의 로그인 사용 설정·Redirect URI, REST API 키·Client Secret |
| NAVER Cloud Platform Maps | [NCP 콘솔](https://console.ncloud.com/) | 사용자·관리자 지도, 주소 확인 | Maps JavaScript용 Client ID와 웹 서비스 URL |
| NAVER Cloud Platform API Gateway | [NCP 콘솔](https://console.ncloud.com/) | 장소 검색 | 지역 검색 API 사용 권한, Client ID·Secret |
| 공공데이터포털 타슈 API | [공공데이터포털](https://www.data.go.kr/) | 대여소별 실시간 자전거 수집 | 해당 OpenAPI 활용 신청과 인증키 |
| 공공데이터포털 기상청 API | [공공데이터포털](https://www.data.go.kr/) | 대전 대표 격자의 기온·강수 수집 | 단기예보 조회서비스 활용 신청과 인증키 |
| AWS ECR | [AWS 콘솔](https://console.aws.amazon.com/) | Frontend·Backend·AI Docker 이미지 보관 | 비공개 저장소와 Push/Pull IAM 권한 |
| AWS S3 | [AWS 콘솔](https://console.aws.amazon.com/) | 수집 원본, DB 백업, AI 모델, 사용자·관리자 사진 보관 | 용도별 비공개 버킷과 작업별 IAM 권한 |
| Firebase Cloud Messaging | [Firebase 콘솔](https://console.firebase.google.com/) | 사용자 푸시 알림 | Firebase 프로젝트와 Backend 서비스 계정 |
| Open-Meteo | [Open-Meteo](https://open-meteo.com/) | AI 개발·평가 시 과거 날씨 공백 보완 | 개발 스크립트의 위치·시간대 설정; 현재 실시간 수집 경로와는 별개 |

## 1. 사용자 로그인: Kakao Developers

- 팀이 관리하는 Kakao Developers 앱에서 **Kakao Login**을 사용한다. Backend가 OAuth 인가 코드를 받아 토큰을 교환하고, 로그인 뒤 Frontend로 돌려보낸다.
- 앱 관리 화면에서 카카오 로그인 사용을 켜고, REST API 키의 Redirect URI 항목에 배포 환경별 콜백 주소를 등록한다. 설정 위치는 [카카오 공식 안내](https://developers.kakao.com/docs/ko/kakaologin/prerequisite)를 따른다.
- Backend에는 `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`을 주입한다. 이 값은 Frontend 빌드 변수에 넣지 않는다.
- Kakao 앱에 등록할 Redirect URI는 배포 경로에 따라 구분한다. Staging은 `<PUBLIC_ORIGIN>/api/auth/oauth/callback/kakao`, Production은 `<PUBLIC_ORIGIN>/production-oauth-callback/kakao`다. 실제 공개 도메인으로 치환하고, 배포 설정 및 Nginx 경로와 정확히 일치시킨다.
- 로그인 성공·실패 후 사용자를 보낼 주소는 별도의 `FRONTEND_OAUTH_SUCCESS_URL`, `FRONTEND_OAUTH_FAILURE_URL`로 설정한다. 이 주소를 Kakao Redirect URI와 혼동하지 않는다.
- 확인: 각 환경에서 로그인 시작 → Kakao 동의 → 원래 환경의 앱으로 복귀하는지 확인한다. Staging 로그인 후 Production 화면으로 이동하면 경로 설정을 다시 점검한다.

## 2. 지도와 장소 검색: NAVER Cloud Platform

두 기능은 **서로 다른 설정**이다. 같은 이름의 ID처럼 보여도 용도와 주입 위치를 구분한다.

- **지도 SDK:** Frontend가 NAVER Maps JavaScript SDK를 로드한다. NCP에서 해당 웹 서비스와 허용 도메인을 설정하고 `VITE_NAVER_MAP_CLIENT_ID`를 **Frontend 빌드 시점**에 넣는다. 이 값은 브라우저로 전달되는 식별자이므로 Secret을 여기에 넣지 않는다. 지도의 Geocoder 기능도 SDK의 해당 서브모듈을 사용한다.
- **장소 검색:** Spring Backend가 NCP API Gateway의 지역 검색 API를 호출한다. `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 **Backend 실행 환경**에만 넣는다. 두 값은 Server A의 별도 Secret 파일에서 staging·production 런타임으로 주입한다.
- 지역 검색 API 요청 형식은 [NAVER Cloud 공식 문서](https://api.ncloud-docs.com/docs/en/naver-api-hub-search-local)를 참고한다. Maps JavaScript Client ID와 장소 검색 자격증명은 용도와 설정 위치가 다르다.
- 확인: 지도 화면이 로드되는지, 장소 검색이 결과를 반환하는지 각각 시험한다. 지도가 보여도 장소 검색 API가 정상이라는 뜻은 아니다.

## 3. 대여소·날씨 데이터: 공공데이터포털

- **타슈 실시간 대여소:** 대전교통공사 타슈 대여소 API 활용 권한을 신청한다. Python Collector에 `TASHU_API_KEY`를 주입한다. 예비 키를 운영하는 경우에만 `TASHU_API_KEY_FALLBACK`을 사용한다.
- **기상청 초단기실황:** 기상청 단기예보 조회서비스의 `getUltraSrtNcst` 활용 권한을 신청한다. 날씨 Collector에 `KMA_API_KEY`를 주입한다. 기본 격자 `KMA_NX=67`, `KMA_NY=100`은 대전 대표 지점이다.
- 두 키는 브라우저에 전달하지 않는다. Collector의 서버 전용 환경파일에 보관한다.
- 확인: Collector 로그·health 파일에서 최신 수집 시각과 오류 여부를 본다. 두 수집기의 소스와 실행법은 각각 `data-pipeline/collector/README.md`, `data-pipeline/weather-collector/README.md`에 있다.

## 4. 이미지와 장기 보관: AWS

- **ECR:** Jenkins가 테스트·빌드 후 Git Commit SHA 기반 태그의 이미지를 private ECR에 Push한다. Server A는 Frontend·Backend 이미지를, Server B는 AI Serving 이미지를 Pull한다. Jenkins Push 권한과 서버별 Pull 권한은 분리한다. ECR 리전은 `ap-northeast-2`다.
- ECR 사용자는 AWS 계정의 [비공개 저장소](https://docs.aws.amazon.com/AmazonECR/latest/userguide/Repositories.html)와 필요한 IAM 권한을 준비한다. 저장소 주소·계정 ID는 팀 내부 인수인계 자료에서 확인하고 이 문서에는 쓰지 않는다.
- **S3 데이터 레이크:** Collector가 로컬에 보존한 Parquet 원본, DB 백업, AI 모델을 각각 필요한 경로에 보관한다. 업로드·백업·모델 읽기 권한은 작업별로 분리한다.
- **S3 사진:** Backend가 제보·관리자 팝업 이미지를 `images/` 객체로 업로드한다. 사진 버킷은 데이터 레이크와 별개이며 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` 네 값을 Backend 실행 환경에 주입한다. 현재 사진 버킷 리전은 `us-east-1`이다. Staging과 Production은 Server A의 공통 비공개 Secret 파일을 사용한다.
- 확인: ECR은 해당 Commit 태그 이미지 조회, S3는 용도별 객체 존재 확인으로 검증한다. 사진은 API 성공뿐 아니라 DB 객체 키와 S3 객체 존재를 함께 확인한다.

## 5. 푸시 알림: Firebase Cloud Messaging

- Backend에는 FCM 토큰 등록·비활성화와 알림 전송 코드가 있다. Firebase 프로젝트의 서비스 계정 JSON을 `firebase.key.path`가 가리키는 **Backend classpath 리소스**로 읽도록 구현돼 있다.
- 서비스 계정 발급과 보관 주의사항은 [Firebase 공식 안내](https://firebase.google.com/docs/admin/setup?hl=ko)를 참고한다.
- 서비스 계정 JSON은 민감한 인증 파일이다. Git에 추가하지 않는다. 배포 이미지에 안전하게 제공되는지와 실제 푸시 수신까지의 종단 동작은 Backend·Frontend 담당자가 최종 확인해야 한다. 이 문서는 코드 존재만으로 운영 동작을 완료했다고 단정하지 않는다.

## 별도 가입이 필요 없는 구성

`OSRM`, MySQL, Redis, Kafka, Spark, Jenkins, Nginx, Prometheus, Loki, Grafana는 프로젝트 서버에서 실행하는 구성 요소다. 위 외부 API 계정과 혼동하지 않는다. Open-Meteo는 `tashu-ai/dev/fetch_openmeteo_weather.py`의 과거 날씨 공백 보완에 쓰인다. 현재 실시간 날씨 수집기는 기상청 API를 사용한다.

참고 코드: [`frontend/.env.example`](../frontend/.env.example), [`frontend/src/features/map/lib/naverMaps.ts`](../frontend/src/features/map/lib/naverMaps.ts), [`backend/good-tashu/src/main/resources/application.properties`](../backend/good-tashu/src/main/resources/application.properties), [`backend/good-tashu/src/main/java/com/s15p21b103/good_tashu/map/config/NaverApiConfig.java`](../backend/good-tashu/src/main/java/com/s15p21b103/good_tashu/map/config/NaverApiConfig.java), [`backend/good-tashu/src/main/java/com/s15p21b103/good_tashu/fcm/FcmConfig.java`](../backend/good-tashu/src/main/java/com/s15p21b103/good_tashu/fcm/FcmConfig.java), [`infra/runtime/backend/scripts/render-staging-env.sh`](../infra/runtime/backend/scripts/render-staging-env.sh), [`infra/runtime/production/scripts/render-backend-env.sh`](../infra/runtime/production/scripts/render-backend-env.sh).
