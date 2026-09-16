# MySQL baseline

Server A에서 MySQL 한 개를 실행하고 production, staging, 실시간 데이터의 DB와 계정을 논리적으로 분리한다. MySQL은 외부 인터넷에 공개하지 않으며 호스트에서는 `127.0.0.1:3306`으로만 접근한다.

## 구성

```text
Server A
└─ tashu-mysql (mysql:8.4.11)
   ├─ tashu_prod / tashu_prod_user
   ├─ tashu_staging / tashu_staging_user
   └─ tashu_data
      ├─ tashu_data_writer (Spark 적재용 DML)
      ├─ tashu_ai_reader (AI 조회용 SELECT)
      └─ tashu_observer (DBeaver 조회용 SELECT)

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
| `scripts/generate-secrets.sh` | Server A에 root/prod/staging 비밀번호 파일을 값 출력 없이 최초 생성 |
| `scripts/bootstrap-databases.sh` | prod/staging DB와 각 전용 사용자를 반복 실행 가능하게 생성 |
| `scripts/verify-isolation.sh` | 두 계정의 자기 DB 접근 성공과 상대 DB 접근 차단을 Secret 노출 없이 검증 |
| `scripts/generate-data-access-secrets.sh` | 데이터·AI·DBeaver 계정 비밀번호를 값 출력 없이 최초 생성 |
| `scripts/bootstrap-data-database.sh` | `tashu_data`와 writer/reader/observer 최소 권한 계정을 반복 실행 가능하게 생성 |
| `scripts/verify-data-isolation.sh` | 세 계정의 허용 작업 성공과 금지 작업 차단을 실제 SQL로 검증 |

## Secret과 데이터 위치

Git에 저장하지 않는 Server A 전용 파일:

```text
/etc/tashu/mysql/root-password
/etc/tashu/mysql/prod-password
/etc/tashu/mysql/staging-password
/etc/tashu/mysql/data-writer-password
/etc/tashu/mysql/ai-reader-password
/etc/tashu/mysql/observer-password
```

각 파일은 `root:root`, mode `0600`이다. 값을 터미널, Git, Jenkins log와 채팅에 출력하지 않는다.

MySQL 데이터는 `tashu-mysql-data` Docker volume에 저장한다. 컨테이너를 교체해도 volume을 삭제하지 않는 한 데이터가 유지된다.

## `ddl-auto=update`에 따른 임시 권한

현재 Backend가 Hibernate `ddl-auto=update`를 사용하므로 prod/staging 사용자에게 DML 권한과 함께 `CREATE`, `ALTER`, `INDEX`, `REFERENCES`를 허용한다. `DROP`과 다른 DB 접근 권한은 주지 않는다.

첫 `main` Blue/Green 배포 전에는 production을 `ddl-auto=validate`로 바꿀지 다시 검토한다. 바꾼 뒤에는 production 사용자에서 DDL 권한도 회수한다.

## 실시간 데이터 DB 권한

`tashu_data`는 애플리케이션 DB와 분리된 실시간 데이터 조회용 DB다. 아직 테이블 스키마는 만들지 않으며, Data 파트의 Spark 적재 스키마가 확정된 뒤 별도 변경으로 적용한다.

| 계정 | 용도 | 허용 권한 |
| --- | --- | --- |
| `tashu_data_writer` | Spark가 Kafka 데이터를 적재 | `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `tashu_data` |
| `tashu_ai_reader` | AI 서빙이 최신·과거 snapshot 조회 | `SELECT` on `tashu_data` |
| `tashu_observer` | 사람이 DBeaver로 상태 확인 | `SELECT` on `tashu_prod`, `tashu_staging`, `tashu_data` |

계정이 `'%'` host로 생성되더라도 MySQL의 호스트 포트는 `127.0.0.1`에만 bind되어 있다. 따라서 인터넷이나 다른 서버에서 직접 접속할 수 없다. Server B의 Spark 연결을 허용할 때는 사설 IP bind, 방화벽, MySQL host 제한을 함께 설계하고 별도로 검증한다.

## DBeaver로 안전하게 조회

DBeaver Community는 Windows에 설치한다. MySQL 포트 `3306`을 인터넷에 열지 않고 DBeaver의 SSH tunnel 기능을 사용한다.

**Main 탭**

| 항목 | 값 |
| --- | --- |
| Server Host | `127.0.0.1` |
| Port | `3306` |
| Database | 비워 두거나 조회할 DB 이름 |
| Username | `tashu_observer` |
| Password | Server A의 `/etc/tashu/mysql/observer-password` 값 |

**SSH 탭**

| 항목 | 값 |
| --- | --- |
| Use SSH Tunnel | 활성화 |
| Host/IP | Server A 호스트명 |
| Port | `22` |
| User name | `ubuntu` |
| Authentication | Public Key |
| Private key | 개인 PC의 PEM 파일 경로 |

연결 흐름은 `DBeaver → SSH 22 → Server A 127.0.0.1:3306 → MySQL`이다. `tashu_observer`는 조회만 가능하므로 실수로 운영 데이터를 수정할 수 없다. PEM과 DB 비밀번호는 Git, 문서, 채팅에 저장하지 않는다.

## 배포 단계

1. 저장소 파일을 Server A `/opt/tashu/mysql`에 전달한다.
2. `generate-secrets.sh`와 `generate-data-access-secrets.sh`로 서버 Secret을 생성한다.
3. `docker compose config`로 최종 설정을 검사한다.
4. MySQL을 시작하고 `healthy`를 확인한다.
5. `bootstrap-databases.sh`와 `bootstrap-data-database.sh`로 DB와 사용자를 생성한다.
6. 계정 분리, 데이터 보존과 백업·복원을 검증한다.

## 완료 기준

- `tashu-mysql`이 `healthy`이고 재부팅 후 자동 시작한다.
- 호스트에서는 `127.0.0.1:3306`만 listen하고 UFW에 3306 규칙이 없다.
- production 사용자는 `tashu_prod`만, staging 사용자는 `tashu_staging`만 접근한다.
- data writer는 `tashu_data` DML만, AI reader와 observer는 허용된 DB의 SELECT만 실행한다.
- 시험 테이블과 행이 컨테이너 재시작·서버 재부팅 후 유지된다.
- 모든 비밀번호 값이 Git과 로그에 없다.
- 실제 `mysqldump`를 빈 시험 DB에 복원한다.
