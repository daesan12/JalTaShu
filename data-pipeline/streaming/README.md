# Kafka → MySQL Structured Streaming

두 운영 Kafka topic의 원본 이벤트를 Spark Structured Streaming으로 읽어 AI가 조회할
MySQL hot store에 저장한다.

| Kafka topic | MySQL table |
| --- | --- |
| `tashu.station-availability.v1` | `tashu_data.station_availability` |
| `tashu.weather-observation.v1` | `tashu_data.weather_observation` |

장기 보존은 Collector가 만든 Parquet의 S3 동기화가 담당한다. 이 작업은 AI 피처를
계산하지 않는다. `delta_30m`, `delta_60m`, `minutes_since_rain`은 AI 서빙 계층이
최근 48시간 원본 이력을 읽어 계산한다.

## 처리 보장

- 각 topic은 독립적인 checkpoint를 사용한다.
- 첫 실행은 Kafka retention 범위의 `earliest`부터 읽고, 이후에는 checkpoint에서 재개한다.
- MySQL 쓰기는 micro-batch 단위 transaction이다.
- `event_id` primary key와 `ON DUPLICATE KEY UPDATE`로 Kafka replay를 멱등 처리한다.
- JSON 계약을 통과하지 못한 메시지는 DB에 넣지 않고 dead-letter JSON으로 저장한다.
- Kafka offset은 topic/partition별 checkpoint가 관리한다.
- Spark SQL과 MySQL session timezone은 UTC다.
- timezone-aware 원본 시각은 Spark SQL 안에서 UTC 문자열로 직렬화한다. Python 또는
  컨테이너 운영체제의 timezone에 의존하지 않는다.

## 운영 환경변수

비밀값이 아닌 설정은 [`.env.example`](.env.example)을 참고한다. DB 설정은 Server B의
`/etc/tashu/streaming/mysql-data-writer.env`에서 제출 컨테이너로만 주입한다.

필수 DB 환경변수:

- `TASHU_DATA_DB_JDBC_URL`
- `TASHU_DATA_DB_USER`
- `TASHU_DATA_DB_PASSWORD`
- `TASHU_DATA_DB_DRIVER`

비밀번호와 실제 Secret 파일은 Git 또는 `/srv/tashu/workspace/data`에 복사하지 않는다.

## 배포와 실행

병합된 `jobs/kafka_mysql_streaming.py`를 Server B의 아래 경로에 배치한다.

```text
/srv/tashu/workspace/data/jobs/kafka_mysql_streaming.py
```

인프라가 제공한 제한 명령으로 제출한다.

```bash
sudo /opt/tashu/spark/scripts/submit-data-job.sh jobs/kafka_mysql_streaming.py
```

checkpoint와 dead-letter 경로:

```text
/srv/tashu/data/spark/checkpoints/kafka-mysql-v2/station
/srv/tashu/data/spark/checkpoints/kafka-mysql-v2/weather
/srv/tashu/data/spark/output/dead-letter/kafka-mysql-v2/
```

checkpoint를 삭제하면 retention 범위의 이벤트를 처음부터 다시 읽는다. 운영 중에는 임의로
삭제하지 않는다. 재처리는 MySQL에서 중복 행을 만들지는 않지만 불필요한 전체 replay가 발생한다.

`v2` checkpoint는 UTC 변환 오류가 있던 `v1`과 의도적으로 분리되어 있다. 최초 v2 배포 시
인프라 담당자가 잘못 적재된 hot-store 행을 초기화한 뒤 실행하면 Kafka retention 범위를
`earliest`부터 다시 적재한다. 기존 v1 checkpoint는 검증이 끝날 때까지 백업으로 보존한다.

## 검증

로컬 계약 테스트는 PySpark나 실제 Secret 없이 실행할 수 있다.

```powershell
& 'C:\Users\SSAFY\miniforge3\python.exe' -m unittest discover `
  -s data-pipeline\streaming\tests -v
```

운영에서는 아래 항목을 확인한다.

1. 두 Structured Streaming query가 모두 active인지 확인한다.
2. `station_availability`와 `weather_observation`의 행 수가 증가하는지 확인한다.
3. 같은 `event_id`를 replay해도 행 수가 증가하지 않는지 확인한다.
4. 작업 재시작 후 checkpoint에서 이어서 처리되는지 확인한다.
5. 최신 완전 snapshot은 `COUNT(*) = MAX(station_count)` 조건을 만족하는지 확인한다.
