# AI serving runtime

`tashu-ai/src/serve.py`를 Server B에서 1분 주기로 실행해 MySQL의 최신 이력을 읽고 AI·Backend가 합의한 Redis 공간의 `pred:*` 키를 갱신한다. 외부 HTTP 포트는 열지 않는다.

## 서버 경로

| 경로 | 역할 | Secret 여부 |
| --- | --- | --- |
| `/opt/tashu/infra/runtime/ai-serving` | Git으로 관리하는 Compose·배포 스크립트 | 아니요 |
| `/etc/tashu/ai-serving/mysql-reader.env` | MySQL SELECT 전용 계정 | 예, `0600 root:root` |
| `/etc/tashu/ai-serving/redis.env` | 합의된 Redis 접속정보 | 예, `0600 root:root` |
| `/etc/tashu/ai-serving/aws-model-reader.env` | S3 모델 v1 읽기 전용 자격증명 | 예, `0600 root:root` |
| `/srv/tashu/ai-serving/models` | SHA-256 검증을 통과한 모델 3파일 | 아니요, 컨테이너에는 읽기 전용 mount |

## 사전 준비

- Server B에 AWS CLI v2와 Docker Compose가 설치돼 있어야 한다.
- ECR Pull 자격증명은 Server A와 공유하지 않고 Server B 전용 IAM 사용자를 `/etc/tashu/ecr-pull/credentials`에 저장한다.
- Jenkins에는 `server-b-deploy-host` 문자열 credential과 `server-b-ai-deploy` SSH 개인키 credential을 둔다.
- Redis host·DB 번호·백엔드 조회 방식은 AI·Backend 합의 후 `/etc/tashu/ai-serving/redis.env`에 넣는다. 합의 전에는 Redis 포트와 AI 컨테이너를 활성화하지 않는다.

## 배포 흐름

1. Jenkins가 `infra/jenkins/pipeline/ai-serving.Dockerfile`로 test와 image build를 수행한다.
2. `develop`의 Commit SHA tag로 private ECR `tashu/ai`에 Push한다.
3. 제한된 SSH 명령으로 Server B의 배포 스크립트를 실행한다.
4. Server B가 S3 v1 모델 3파일을 받고 저장소의 manifest로 SHA-256을 검사한다.
5. 새 image를 Pull하고 MySQL `SELECT 1`, 합의된 Redis DB `PING`을 통과시킨 뒤 컨테이너를 교체한다.
6. 실패하면 직전 image로 복구한다. 데이터 준비 조건이 부족할 때 `serve.py`가 `미가동` 로그를 남기고 Redis를 쓰지 않는 것은 정상 동작이다.

Redis 6379는 공인망에 열지 않는다. Server A Redis는 사설 주소에만 bind하고 UFW에서 Server B 사설 IP만 허용한다.
