# MySQL 자동 백업과 복구 검증

이 문서는 Server A의 MySQL production과 staging DB를 6시간마다 압축 백업하고, 운영 DB와 분리된 임시 MySQL에서 실제 복구를 검증하는 방법을 설명한다.

## 파일 역할

| 파일 | 역할 |
| --- | --- |
| `scripts/backup-databases.sh` | `tashu_prod`와 `tashu_staging`을 하나의 SQL로 dump하고 gzip 압축, 무결성 검사와 SHA-256 생성을 수행한다. |
| `scripts/verify-backup-restore.sh` | 외부 포트와 영구 volume이 없는 임시 MySQL에 백업을 복원하고 두 DB 생성을 확인한 뒤 컨테이너를 삭제한다. |
| `scripts/upload-backups-to-s3.sh` | checksum이 정상인 완성 백업과 checksum 파일만 비공개 S3의 `backups/mysql/`에 복사한다. |
| `scripts/configure-s3-backup-credential.sh` | S3 백업 전용 IAM key를 화면에 다시 출력하지 않고 root 전용 파일로 저장한다. |
| `systemd/tashu-mysql-backup.service` | 백업 스크립트를 root oneshot 작업으로 실행하고 쓰기 가능 경로를 백업 폴더와 lock 파일로 제한한다. |
| `systemd/tashu-mysql-backup.timer` | UTC 00:15, 06:15, 12:15, 18:15을 기준으로 최대 10분의 임의 지연을 두고 실행한다. 놓친 실행은 다음 부팅 때 보충한다. |
| `systemd/tashu-mysql-backup-upload.service` | 로컬 백업과 분리된 작업으로 검증된 파일을 S3에 한 번 업로드한다. |
| `systemd/tashu-mysql-backup-upload.timer` | 로컬 백업 예약보다 15분 늦게 S3 업로드를 호출한다. |
| `aws/iam-s3-backup-policy.json` | DB 백업 prefix만 읽고 쓸 수 있고 삭제할 수 없는 최소 권한 정책이다. |
| `aws/s3-backup-lifecycle.json` | DB 백업을 30일 후 만료시키는 수명 주기 정책 초안이다. 적용 전 사용자 확인이 필요하다. |

## 저장 결과

Server A에 설치하면 다음 파일이 생성된다.

```text
/srv/tashu/backups/mysql/tashu-mysql-YYYYMMDDTHHMMSSZ.sql.gz
/srv/tashu/backups/mysql/tashu-mysql-YYYYMMDDTHHMMSSZ.sql.gz.sha256
```

임시 파일에 쓰기를 마치고 gzip 검사를 통과한 뒤 최종 파일명으로 바꾸므로, 중간에 실패한 dump를 완성본으로 오인하지 않는다.

## 보안과 실패 처리

- 비밀번호는 Git이나 명령 인자에 넣지 않고 MySQL 컨테이너 안의 `/run/secrets/mysql_root_password`에서 읽는다.
- MySQL 컨테이너가 `healthy`가 아니면 백업을 시작하지 않는다.
- `flock`으로 수동 실행과 예약 실행의 중복을 막는다.
- 백업 파일은 `root:root`, 디렉터리 `0750`, 파일 `0640`으로 유지한다.
- 기본 로컬 보존 기간은 7일이다.
- 백업 성공은 파일 존재가 아니라 gzip 검사, SHA-256 검사와 빈 DB 실제 restore까지 확인해야 한다.

## 설치 및 검증 순서

1. Bash 문법과 systemd unit을 Server A 임시 경로에서 검사한다.
2. 스크립트를 `/usr/local/sbin`에 설치하고 한 번 수동 실행한다.
3. 생성 파일의 권한, 크기, gzip과 SHA-256을 확인한다.
4. 별도 임시 DB 두 개에 실제 restore하고 표와 행 수를 확인한다.
5. timer를 enable한 뒤 예약 실행과 재부팅 후 활성 상태를 확인한다.
6. S3 backup prefix와 IAM 권한을 별도로 정한 뒤 암호화된 원격 복사본을 추가한다.

## S3 원격 복사 설계

- 목적지는 `s3://<private-bucket>/backups/mysql/`이다.
- Collector의 Bronze 자격증명과 분리한 MySQL 백업 전용 IAM 사용자를 쓴다.
- IAM에는 지정 prefix의 목록, 업로드와 복구 다운로드만 허용하고 `DeleteObject`는 주지 않는다.
- S3 업로드가 실패해도 로컬 MySQL 백업과 운영 DB는 영향을 받지 않도록 별도 service와 timer로 실행한다.
- 업로드 전 모든 gzip 백업의 SHA-256을 다시 검사한다.
- 서버의 로컬 백업은 7일, S3 백업은 30일 보관하는 안을 사용한다. S3 수명 주기는 자동 삭제 설정이므로 적용 전에 검토한다.
## 실제 복구 검증

최신 백업 파일을 지정해 다음 명령을 실행한다.

```bash
sudo /opt/tashu/mysql/scripts/verify-backup-restore.sh \
  /srv/tashu/backups/mysql/<backup-file>.sql.gz
```

복구 시험 컨테이너는 `--network none`으로 외부 통신과 포트 공개가 없고, `/var/lib/mysql`은 임시 메모리 파일시스템을 사용한다. 시험 성공 여부와 관계없이 컨테이너를 삭제하므로 운영 `tashu-mysql`과 데이터 volume에는 영향을 주지 않는다.

## 2026-09-11 검증 결과

- Bash와 systemd timer 문법 검사 통과
- 실제 `tashu_prod`·`tashu_staging` 압축 dump 생성
- gzip 검사와 SHA-256 검사 통과
- 격리된 MySQL `8.4.11`에 실제 복원 후 두 DB 확인
- Server A에 백업 service와 6시간 timer 설치
- 첫 정식 백업 성공, timer `enabled`·`active` 확인
- 존재하지 않는 MySQL을 지정했을 때 완성 파일 없이 실패하는 동작 확인
- lock을 선점한 상태에서 두 번째 백업이 종료 코드 75로 차단되는 동작 확인
