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
| `scripts/jenkins-production-deploy.sh` | 후보 준비, Nginx 전환, 이전 slot 롤백 | 없음 |
| `/etc/tashu/backend-production/runtime.env` | 운영 DB·Redis·JWT·OAuth 최종 환경변수 | Server A 전용, Git 금지 |
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
7. 공개 Frontend·Backend 검증이 실패하면 이전 slot으로 자동 롤백한다.

승인 대기 제한은 15분이다. `Abort`하거나 시간이 지나면 기존 활성 slot은 바뀌지 않는다.
새 candidate 컨테이너는 트래픽을 받지 않은 채 남아 다음 점검에 사용할 수 있다.
`Proceed`는 Jenkins에서 Build 권한이 있는 로그인 사용자만 누를 수 있다. 승인 대기 중에는
현재 단일 Docker Agent executor 하나를 최대 15분 사용하므로 다른 Pipeline은 대기할 수 있다.

## 운영 환경파일

Server A에서 다음 명령을 한 번 실행한다.

```bash
sudo /opt/tashu/infra/runtime/production/scripts/render-backend-env.sh
```

이 스크립트는 기존 Kakao·JWT Secret, MySQL production 비밀번호, Redis 비밀번호를 읽어
`/etc/tashu/backend-production/runtime.env`를 `0600 root:root`로 만든다. 값은 출력하지 않는다.
production OAuth 성공·실패 주소는 각각 공개 origin의 `/`, `/login`이다.
Kakao 개발자 콘솔에는 기존 staging callback과 별도로 production callback
`https://j15b103.p.ssafy.io/production-oauth-callback/kakao`를 등록해야 한다.

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
