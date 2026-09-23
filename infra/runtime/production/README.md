# Production Blue/Green runtime

Server A 한 대에서 production Frontend와 Backend를 Blue·Green 두 slot으로 실행한다.
Nginx는 한 번에 한 slot만 사용자에게 연결하며, 새 버전은 비활성 slot에서 health check를
통과한 뒤 Jenkins 승인을 받아 전환한다. staging 컨테이너와 `/staging/` 경로는 유지한다.

## 구조

| slot | Frontend loopback | Backend loopback |
| --- | --- | --- |
| Blue | `127.0.0.1:28080` | `127.0.0.1:28081` |
| Green | `127.0.0.1:28082` | `127.0.0.1:28083` |

포트는 인터넷에 공개하지 않는다. Nginx만 `80/443`에서 활성 slot으로 요청을 전달한다.
Blue와 Green Backend는 같은 `tashu_prod` MySQL DB와 Redis database `0`을 사용한다.
따라서 전환 중에도 데이터와 Refresh Token 상태를 공유한다.

## 파일 역할

| 경로 | 역할 | Secret |
| --- | --- | --- |
| `compose.yml` | slot별 컨테이너, loopback 포트, health check와 자원 제한 | 없음 |
| `scripts/render-backend-env.sh` | 서버 Secret으로 production Backend 환경파일 생성 | 없음 |
| `scripts/deploy-slot.sh` | 지정한 slot에 이미 pull한 immutable ECR image 실행 | 없음 |
| `scripts/jenkins-production-deploy.sh` | 후보 준비·정리, Nginx 전환, 이전 slot 롤백 | 없음 |
| `/etc/tashu/backend-production/runtime.env` | 운영 DB·Redis·JWT·OAuth 최종 환경변수 | Server A 전용, Git 금지 |
| `/etc/tashu/backend-common/photo-s3.env` | staging·production이 공유하는 사진 bucket 전용 자격증명 | Server A 전용, Git 금지 |
| `/var/lib/tashu-production/` | 활성·이전·후보 slot과 SHA 상태 | Secret 없음 |

Frontend production image는 경로 `/`, API `/api`, 로그인 `/auth`로 빌드한다.
staging과 빌드 결과가 다르므로 ECR tag는 `prod-<12자리 Git SHA>`를 사용한다.
Backend도 같은 tag를 사용해 한 배포의 두 image를 명확히 묶는다.

## Jenkins 흐름

1. `main` Commit을 테스트한다.
2. `prod-<SHA>` Frontend·Backend image를 ECR에 Push한다.
3. 현재 사용하지 않는 slot에 두 image를 배포한다.
4. Docker health와 Frontend `/health`, Backend Actuator health를 검사한다.
5. Jenkins가 `Proceed` 또는 `Abort` 입력을 기다린다.
6. `Proceed`이면 Nginx upstream 두 개를 같은 slot으로 바꾸고 한 번만 reload한다.
7. 인증서의 공개 도메인으로 최대 30초 동안 Frontend·Backend 응답을 반복 확인한다.
8. 공개 Frontend·Backend 검증이 실패하면 이전 slot으로 자동 롤백한다.
9. 실패·`Abort`·시간 초과이면 활성화되지 않은 candidate 컨테이너와 후보 상태를 자동 정리한다.

승인 대기 제한은 15분이다. `Abort`하거나 시간이 지나면 기존 활성 slot은 바뀌지 않는다.
승인 대기 중에는 활성 slot과 candidate slot이 함께 실행되지만 Nginx는 활성 slot에만
사용자 트래픽을 보낸다. 승인하지 않은 배포가 끝나면 candidate 컨테이너와
`candidate-slot`, `candidate-sha` 상태 파일을 제거한다. 정리 요청 SHA가 저장된 candidate SHA와
다르거나 candidate가 이미 활성 slot이면 삭제하지 않는다.

`Proceed`로 전환에 성공한 뒤에는 빠른 롤백을 위해 직전 slot을 실행 상태로 유지한다.
따라서 성공 후 Blue와 Green이 함께 실행되는 것은 의도한 동작이다. `Proceed`는 Jenkins에서
Build 권한이 있는 로그인 사용자만 누를 수 있다. 승인 대기 중에는 현재 단일 Docker Agent
executor 하나를 최대 15분 사용하므로 다른 Pipeline은 대기할 수 있다.
SSH 접속에는 Server A 사설 주소를 사용하고, HTTPS health 검사에는 인증서의 공개 도메인을
사용한다. Nginx graceful reload 직후에는 이전 worker가 짧게 응답할 수 있어 한 번의 요청으로
성공·실패를 판단하지 않는다.

자동 정리에 실패했을 때 관리자는 같은 Build SHA로 안전하게 다시 실행할 수 있다.

```bash
sudo /opt/tashu/infra/runtime/production/scripts/jenkins-production-deploy.sh \
  cleanup <12자리 Git SHA>
```

저장된 candidate SHA가 다르거나 candidate가 이미 active slot이면 명령은 삭제를 거부한다.
정상 정리 대상은 candidate Frontend·Backend 컨테이너와 두 candidate 상태 파일뿐이며,
Blue·Green이 공유하는 `tashu-app` Docker network는 삭제하지 않는다.

## 운영 환경파일

Server A에서 다음 명령을 한 번 실행한다.

```bash
sudo /opt/tashu/infra/runtime/production/scripts/render-backend-env.sh
```

이 스크립트는 기존 Kakao·JWT Secret, MySQL production 비밀번호, Redis 비밀번호,
Naver Place 자격증명, 사진 S3 전용 자격증명과 관리자 초기 계정 설정을 읽어
`/etc/tashu/backend-production/runtime.env`를 `0600 root:root`로 만든다. 값은 출력하지 않는다.
production OAuth 성공·실패 주소는 각각 공개 origin의 `/`, `/login`이다.
Kakao 개발자 콘솔에는 기존 staging callback과 별도로 production callback
`https://j15b103.p.ssafy.io/production-oauth-callback/kakao`를 등록해야 한다.

Backend는 인증용 Redis DB 0, 실시간 대여소·날씨 조회용 Redis DB 0,
AI 예측 조회용 Redis DB 2를 사용한다. OSRM 세 컨테이너는 `tashu-app` network의
서비스 이름으로 연결하고 DEM은 `/opt/tashu/osrm/osrm-uphill/dem`을 읽기 전용으로
`/app/dem`에 마운트한다.

필수 Server A Secret 원본은 다음과 같으며 Git에 넣지 않는다.

```text
/etc/tashu/backend-staging/oauth.env
/etc/tashu/backend-staging/jwt.env
/etc/tashu/mysql/prod-password
/etc/tashu/redis/runtime.env
/etc/tashu/backend-common/naver-place.env
/etc/tashu/backend-common/admin-bootstrap.env
/etc/tashu/backend-common/photo-s3.env
```

사진 S3 Secret은 staging과 같은 `/etc/tashu/backend-common/photo-s3.env`를 사용하며
Access Key ID·Secret Access Key·Region·Bucket 네 값을 보관한다. 최종 production
환경파일에도 이 네 값과 파일 5MB·요청 6MB 제한이 들어간다.

공개 production에서 초기 관리자 생성이 활성화된 경우 비밀번호는 12자 이상이어야 한다.
초기 계정 생성과 로그인 검증이 끝나면 `ADMIN_BOOTSTRAP_ENABLED=false`로 바꾸고 다음
Backend 배포에서 runtime 환경파일을 다시 생성한다.

## 수동 검증

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
sudo cat /var/lib/tashu-production/active-slot
sudo cat /var/lib/tashu-production/active-sha
curl --fail https://j15b103.p.ssafy.io/health
curl --fail https://j15b103.p.ssafy.io/
curl --fail https://j15b103.p.ssafy.io/api/actuator/health
```

정상 결과는 활성 Frontend·Backend가 모두 `healthy`, 공개 Frontend HTTP 200,
Backend body의 `status=UP`이다.

2026-09-15 실제 검증에서는 비활성 Blue의 내부 health를 확인한 뒤 공개 경로를 Blue로 전환했다.
운영 `/`, `/health`, `/api/actuator/health`와 기존 staging 두 경로가 모두 HTTP 200이었다.
그다음 legacy Nginx로 롤백해 운영 `/`가 다시 404이고 staging은 계속 HTTP 200임을 확인했다.

## 롤백

이전 slot이 healthy이면 다음 관리자 명령으로 즉시 되돌린다.

```bash
sudo /opt/tashu/infra/runtime/production/scripts/jenkins-production-deploy.sh rollback
```

첫 production 전환 뒤에는 이전 production SHA가 없다. 이때 롤백하면 Blue/Green 추가 전의
Nginx 설정으로 복구되어 운영 `/`가 다시 404가 되고 staging은 유지된다.

## 제한과 주의

- 두 slot은 같은 Server A에서 실행하므로 서버 장애에 대한 고가용성은 아니다.
- DB schema 변경은 두 Backend 버전이 동시에 사용할 수 있어야 한다.
- 현재 팀 결정에 따라 Hibernate `ddl-auto=update`를 유지한다. 파괴적인 schema 변경은
  Blue/Green만으로 되돌릴 수 없으므로 배포 전에 별도 DB 백업과 호환성 검토가 필요하다.
- Nginx 전환은 Frontend와 Backend upstream을 함께 바꾼 뒤 설정 검사와 reload를 수행한다.
- 현재 Backend가 서버 메모리에 OAuth 요청 상태를 보관한다면 전환 순간 진행 중인 로그인 한 건은
  실패할 수 있다. 이 경우 로그인 재시도로 복구되며, 장기적으로 상태를 Redis에 공유할 수 있다.
