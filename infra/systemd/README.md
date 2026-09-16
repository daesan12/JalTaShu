# Tashu systemd units

이 디렉터리는 Server A에서 Collector와 S3 Bronze 동기화를 재현하기 위한 설정을 보관한다. Secret 값은 포함하지 않는다.

## 파일 역할

| 파일 | 역할 | 실행 형태 |
| --- | --- | --- |
| `tashu-collector.service` | 실시간 대여소 Collector를 부팅 시 시작하고 장애 시 재시작 | 계속 실행되는 서비스 |
| `tashu-s3-sync` | 완성된 대여소 snapshot `*.parquet`만 S3 Bronze prefix로 동기화 | 실행 후 종료되는 스크립트 |
| `tashu-s3-sync.service` | 대여소 동기화 스크립트를 `tashu-collector` 계정으로 한 번 실행 | `oneshot` 서비스 |
| `tashu-s3-sync.timer` | 대여소 동기화 서비스를 매시간 호출하고 놓친 실행을 부팅 후 보충 | 계속 대기하는 timer |
| `tashu-weather-s3-sync` | 완성된 날씨 observation `*.parquet`만 별도 S3 Bronze prefix로 동기화 | 실행 후 종료되는 스크립트 |
| `tashu-weather-s3-sync.service` | 날씨 동기화를 `tashu-weather` 계정으로 한 번 실행 | `oneshot` 서비스 |
| `tashu-weather-s3-sync.timer` | 날씨 동기화를 매시간 호출하고 놓친 실행을 부팅 후 보충 | 계속 대기하는 timer |

## 데이터 흐름

```text
Tashu Collector
  -> .parquet.tmp 작성
  -> os.replace()로 최종 .parquet 확정
  -> tashu-s3-sync.timer가 매시간 확정된 *.parquet만 업로드
  -> s3://<private-bucket>/bronze/realtime/snapshots/

Weather Collector
  -> observations/dt=YYYY-MM-DD/*.parquet 작성
  -> tashu-weather-s3-sync.timer가 매시간 확정된 *.parquet만 업로드
  -> s3://<private-bucket>/bronze/realtime/weather/observations/
```

두 스크립트 모두 `aws s3 sync`에 `--delete`를 사용하지 않는다. Server A의 파일을 정리해도 S3 객체를 함께 삭제하지 않는다. 이미 동일한 파일은 다시 올리지 않고 누락되거나 달라진 파일만 전송한다. 날씨의 `latest.json`과 `health.json`은 운영 상태 파일이므로 장기 보존 대상에서 제외한다.

## 서버 경로와 권한

```text
/usr/local/sbin/tashu-s3-sync                      0755 root:root
/etc/systemd/system/tashu-s3-sync.service          0644 root:root
/etc/systemd/system/tashu-s3-sync.timer            0644 root:root
/usr/local/sbin/tashu-weather-s3-sync              0755 root:root
/etc/systemd/system/tashu-weather-s3-sync.service  0644 root:root
/etc/systemd/system/tashu-weather-s3-sync.timer    0644 root:root
/etc/tashu-collector/aws-credentials               0640 root:tashu-collector
```

AWS credential은 저장소에 복사하지 않는다. IAM은 지정된 `bronze/realtime/*` prefix의 읽기·쓰기와 제한된 목록 조회만 허용하고 `DeleteObject`는 허용하지 않는다. 날씨 unit은 `SupplementaryGroups=tashu-collector`를 해당 프로세스에만 부여해 기존 credential을 읽으며, OS 사용자 그룹이나 Secret 파일을 복제하지 않는다.

## 설치와 확인

설정 파일을 서버 경로에 설치한 뒤 다음 순서로 검증한다.

```bash
sudo systemctl daemon-reload
sudo systemctl start tashu-s3-sync.service
sudo systemctl start tashu-weather-s3-sync.service
systemctl show tashu-s3-sync.service tashu-weather-s3-sync.service -p Result -p ExecMainStatus -p ActiveState
sudo systemctl enable --now tashu-s3-sync.timer tashu-weather-s3-sync.timer
systemctl list-timers tashu-s3-sync.timer tashu-weather-s3-sync.timer --no-pager
```

두 sync service는 `oneshot`이므로 성공 후 `ActiveState=inactive`가 정상이다. `Result=success`와 `ExecMainStatus=0`을 함께 확인한다. timer는 `enabled`와 `active`여야 한다.

로그는 다음 명령으로 확인한다.

```bash
sudo journalctl -u tashu-s3-sync.service -u tashu-weather-s3-sync.service -n 50 --no-pager
```

## 중단과 제거

날씨 동기화만 중단하고 제거하려면 다음을 실행한다.

```bash
sudo systemctl disable --now tashu-weather-s3-sync.timer
sudo rm /etc/systemd/system/tashu-weather-s3-sync.timer
sudo rm /etc/systemd/system/tashu-weather-s3-sync.service
sudo rm /usr/local/sbin/tashu-weather-s3-sync
sudo systemctl daemon-reload
```

이 절차는 날씨 자동 업로드만 제거한다. Collector, 로컬 Parquet, 기존 타슈 동기화와 이미 업로드한 S3 객체는 삭제하지 않는다.
