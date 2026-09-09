# MySQL baseline

Server A에서 MySQL 한 개를 실행하고 production과 staging의 데이터·계정을 논리적으로 분리한다. MySQL은 외부 인터넷에 공개하지 않으며 호스트에서는 `127.0.0.1:3306`으로만 접근한다.

## 구성

```text
Server A
└─ tashu-mysql (mysql:8.4.11)
   ├─ tashu_prod / tashu_prod_user
   └─ tashu_staging / tashu_staging_user

Docker volume: tashu-mysql-data
Docker network: tashu-app
```

Backend 컨테이너는 같은 `tashu-app` Docker network에서 `tashu-mysql:3306`으로 접속한다. PC의 DBeaver는 필요할 때 SSH tunnel을 통해 Server A의 `127.0.0.1:3306`으로 접속한다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `compose.yml` | MySQL 이미지, loopback 포트, volume, health check와 자원 한도 정의 |
| `.env.example` | Secret 값이 아닌 서버 경로 예시 |
| `conf.d/tashu.cnf` | UTF-8, UTC, 연결 수와 InnoDB 메모리 기준 |
| `scripts/generate-secrets.sh` | Server A에 3개 비밀번호 파일을 값 출력 없이 최초 생성 |
| `scripts/bootstrap-databases.sh` | prod/staging DB와 각 전용 사용자를 반복 실행 가능하게 생성 |
| `scripts/verify-isolation.sh` | 두 계정의 자기 DB 접근 성공과 상대 DB 접근 차단을 Secret 노출 없이 검증 |

## Secret과 데이터 위치

Git에 저장하지 않는 Server A 전용 파일:

```text
/etc/tashu/mysql/root-password
/etc/tashu/mysql/prod-password
/etc/tashu/mysql/staging-password
```

각 파일은 `root:root`, mode `0600`이다. 값을 터미널, Git, Jenkins log와 채팅에 출력하지 않는다.

MySQL 데이터는 `tashu-mysql-data` Docker volume에 저장한다. 컨테이너를 교체해도 volume을 삭제하지 않는 한 데이터가 유지된다.

## `ddl-auto=update`에 따른 임시 권한

현재 Backend가 Hibernate `ddl-auto=update`를 사용하므로 prod/staging 사용자에게 DML 권한과 함께 `CREATE`, `ALTER`, `INDEX`, `REFERENCES`를 허용한다. `DROP`과 다른 DB 접근 권한은 주지 않는다.

첫 `main` Blue/Green 배포 전에는 production을 `ddl-auto=validate`로 바꿀지 다시 검토한다. 바꾼 뒤에는 production 사용자에서 DDL 권한도 회수한다.

## 배포 단계

1. 저장소 파일을 Server A `/opt/tashu/mysql`에 전달한다.
2. `generate-secrets.sh`로 서버 Secret을 생성한다.
3. `docker compose config`로 최종 설정을 검사한다.
4. MySQL을 시작하고 `healthy`를 확인한다.
5. `bootstrap-databases.sh`로 DB와 사용자를 생성한다.
6. 계정 분리, 데이터 보존과 백업·복원을 검증한다.

## 완료 기준

- `tashu-mysql`이 `healthy`이고 재부팅 후 자동 시작한다.
- 호스트에서는 `127.0.0.1:3306`만 listen하고 UFW에 3306 규칙이 없다.
- production 사용자는 `tashu_prod`만, staging 사용자는 `tashu_staging`만 접근한다.
- 시험 테이블과 행이 컨테이너 재시작·서버 재부팅 후 유지된다.
- root·production·staging 비밀번호 값이 Git과 로그에 없다.
- 실제 `mysqldump`를 빈 시험 DB에 복원한다.
