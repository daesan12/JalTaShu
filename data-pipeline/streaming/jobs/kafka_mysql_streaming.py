"""Persist Tashu station and weather Kafka events to the hot MySQL store.

The job intentionally stores raw observations only. Online feature calculations such
as delta_30m, delta_60m, and minutes_since_rain remain the AI serving layer's job.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Iterable, Mapping, Sequence


LOGGER = logging.getLogger("tashu-kafka-mysql-streaming")

STATION_TABLE = "station_availability"
WEATHER_TABLE = "weather_observation"

STATION_COLUMNS = (
    "event_id",
    "schema_version",
    "snapshot_id",
    "station_count",
    "collected_at",
    "station_id",
    "station_name",
    "lat",
    "lon",
    "bikes",
)
WEATHER_COLUMNS = (
    "event_id",
    "schema_version",
    "observed_at",
    "fetched_at",
    "nx",
    "ny",
    "temperature",
    "rainfall_1h",
    "source",
)

_ENV_REQUIRED = (
    "TASHU_DATA_DB_JDBC_URL",
    "TASHU_DATA_DB_USER",
    "TASHU_DATA_DB_PASSWORD",
    "TASHU_DATA_DB_DRIVER",
)
_MYSQL_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass(frozen=True)
class Settings:
    kafka_bootstrap_servers: str
    station_topic: str
    weather_topic: str
    checkpoint_root: str
    dead_letter_root: str
    trigger_seconds: int
    starting_offsets: str
    max_offsets_per_trigger: int
    jdbc_url: str
    jdbc_user: str
    jdbc_password: str
    jdbc_driver: str


def _positive_int(env: Mapping[str, str], name: str, default: int) -> int:
    raw = env.get(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc
    if value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return value


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Read non-secret stream settings and the injected MySQL credentials."""
    values = os.environ if env is None else env
    missing = [name for name in _ENV_REQUIRED if not values.get(name, "").strip()]
    if missing:
        raise RuntimeError(f"missing database environment: {', '.join(missing)}")

    starting_offsets = values.get("TASHU_STREAM_STARTING_OFFSETS", "earliest").strip()
    if starting_offsets not in {"earliest", "latest"}:
        raise RuntimeError(
            "TASHU_STREAM_STARTING_OFFSETS must be either earliest or latest"
        )

    return Settings(
        kafka_bootstrap_servers=values.get(
            "TASHU_KAFKA_BOOTSTRAP_SERVERS", "172.26.4.110:9092"
        ).strip(),
        station_topic=values.get(
            "TASHU_STATION_TOPIC", "tashu.station-availability.v1"
        ).strip(),
        weather_topic=values.get(
            "TASHU_WEATHER_TOPIC", "tashu.weather-observation.v1"
        ).strip(),
        checkpoint_root=values.get(
            "TASHU_STREAM_CHECKPOINT_ROOT",
            "/srv/tashu/spark/checkpoints/kafka-mysql-v2",
        ).rstrip("/"),
        dead_letter_root=values.get(
            "TASHU_STREAM_DEAD_LETTER_ROOT",
            "/srv/tashu/spark/output/dead-letter/kafka-mysql-v2",
        ).rstrip("/"),
        trigger_seconds=_positive_int(values, "TASHU_STREAM_TRIGGER_SECONDS", 10),
        starting_offsets=starting_offsets,
        max_offsets_per_trigger=_positive_int(
            values, "TASHU_STREAM_MAX_OFFSETS_PER_TRIGGER", 100_000
        ),
        jdbc_url=values["TASHU_DATA_DB_JDBC_URL"].strip(),
        jdbc_user=values["TASHU_DATA_DB_USER"].strip(),
        jdbc_password=values["TASHU_DATA_DB_PASSWORD"],
        jdbc_driver=values["TASHU_DATA_DB_DRIVER"].strip(),
    )


def mysql_insert_sql(table: str, columns: Sequence[str]) -> str:
    """Build an immutable-event upsert used for Kafka replay safety."""
    if not _MYSQL_IDENTIFIER.fullmatch(table):
        raise ValueError(f"unsafe MySQL table identifier: {table}")
    if not columns or any(not _MYSQL_IDENTIFIER.fullmatch(col) for col in columns):
        raise ValueError("unsafe or empty MySQL column list")
    quoted_columns = ", ".join(f"`{column}`" for column in columns)
    placeholders = ", ".join("?" for _ in columns)
    # Events are immutable. A duplicate primary/unique key is therefore a no-op.
    return (
        f"INSERT INTO `{table}` ({quoted_columns}) VALUES ({placeholders}) "
        f"ON DUPLICATE KEY UPDATE `event_id` = `{table}`.`event_id`"
    )


def utc_mysql_timestamp(value: datetime) -> str:
    """Serialize an aware instant as a MySQL UTC timestamp without local TZ use."""
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp datetime must include a timezone")
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")


def _jdbc_value(value: Any) -> Any:
    """Convert values to stable JDBC inputs and reject ambiguous datetimes."""
    if isinstance(value, datetime):
        return utc_mysql_timestamp(value)
    return value


def _set_statement_value(statement: Any, index: int, value: Any) -> None:
    if isinstance(value, bool):
        statement.setBoolean(index, value)
    elif isinstance(value, int):
        statement.setLong(index, value)
    elif isinstance(value, float):
        statement.setDouble(index, value)
    else:
        statement.setString(index, str(_jdbc_value(value)))


def execute_mysql_upsert(
    rows: Iterable[Any],
    *,
    columns: Sequence[str],
    table: str,
    settings: Settings,
    jvm: Any,
    batch_size: int = 1_000,
) -> int:
    """Write one micro-batch transactionally through the driver's JDBC connection."""
    jvm.java.lang.Class.forName(settings.jdbc_driver)
    connection = jvm.java.sql.DriverManager.getConnection(
        settings.jdbc_url, settings.jdbc_user, settings.jdbc_password
    )
    statement = None
    written = 0
    pending = 0
    try:
        connection.setAutoCommit(False)
        timezone_statement = connection.createStatement()
        try:
            timezone_statement.execute("SET SESSION time_zone = '+00:00'")
        finally:
            timezone_statement.close()

        statement = connection.prepareStatement(mysql_insert_sql(table, columns))
        for row in rows:
            for index, column in enumerate(columns, start=1):
                _set_statement_value(statement, index, row[column])
            statement.addBatch()
            pending += 1
            written += 1
            if pending >= batch_size:
                statement.executeBatch()
                statement.clearBatch()
                pending = 0
        if pending:
            statement.executeBatch()
            statement.clearBatch()
        connection.commit()
        return written
    except Exception:
        connection.rollback()
        raise
    finally:
        if statement is not None:
            statement.close()
        connection.close()


def _station_schema() -> Any:
    from pyspark.sql.types import (
        DoubleType,
        IntegerType,
        LongType,
        StringType,
        StructField,
        StructType,
    )

    return StructType(
        [
            StructField("schema_version", IntegerType()),
            StructField("event_id", StringType()),
            StructField("snapshot_id", StringType()),
            StructField("station_count", IntegerType()),
            StructField("collected_at", StringType()),
            StructField("station_id", StringType()),
            StructField("station_name", StringType()),
            StructField("lat", DoubleType()),
            StructField("lon", DoubleType()),
            StructField("bikes", LongType()),
        ]
    )


def _weather_schema() -> Any:
    from pyspark.sql.types import (
        DoubleType,
        IntegerType,
        StringType,
        StructField,
        StructType,
    )

    return StructType(
        [
            StructField("schema_version", IntegerType()),
            StructField("event_id", StringType()),
            StructField("observed_at", StringType()),
            StructField("fetched_at", StringType()),
            StructField("nx", IntegerType()),
            StructField("ny", IntegerType()),
            StructField("temperature", DoubleType()),
            StructField("rainfall_1h", DoubleType()),
            StructField("source", StringType()),
        ]
    )


def _read_topic(spark: Any, settings: Settings, topic: str) -> Any:
    return (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", settings.kafka_bootstrap_servers)
        .option("subscribe", topic)
        .option("startingOffsets", settings.starting_offsets)
        .option("failOnDataLoss", "true")
        .option("maxOffsetsPerTrigger", settings.max_offsets_per_trigger)
        .load()
        .selectExpr(
            "CAST(value AS STRING) AS raw_payload",
            "topic AS kafka_topic",
            "partition AS kafka_partition",
            "offset AS kafka_offset",
            "timestamp AS kafka_timestamp",
        )
    )


def _parse_station_stream(raw: Any) -> Any:
    from pyspark.sql import functions as F

    parsed = raw.withColumn(
        "event", F.from_json(F.col("raw_payload"), _station_schema())
    ).select(
        "raw_payload",
        "kafka_topic",
        "kafka_partition",
        "kafka_offset",
        "kafka_timestamp",
        "event.*",
    )
    parsed = parsed.withColumn(
        "collected_at_utc", F.try_to_timestamp("collected_at")
    )

    checks = [
        (F.col("schema_version") == 1, "unsupported_schema_version"),
        (
            F.length(F.trim("event_id")).between(1, 191),
            "invalid_event_id",
        ),
        (
            F.length(F.trim("snapshot_id")).between(1, 64),
            "invalid_snapshot_id",
        ),
        (F.col("station_count") > 0, "invalid_station_count"),
        (F.col("collected_at_utc").isNotNull(), "invalid_collected_at"),
        (
            F.length(F.trim("station_id")).between(1, 64),
            "invalid_station_id",
        ),
        (
            F.length(F.trim("station_name")).between(1, 255),
            "invalid_station_name",
        ),
        (
            (~F.isnan("lat")) & F.col("lat").between(-90.0, 90.0),
            "invalid_lat",
        ),
        (
            (~F.isnan("lon")) & F.col("lon").between(-180.0, 180.0),
            "invalid_lon",
        ),
        (F.col("bikes") >= 0, "invalid_bikes"),
    ]
    normalized_checks = [
        (F.coalesce(condition, F.lit(False)), reason)
        for condition, reason in checks
    ]
    valid = normalized_checks[0][0]
    for condition, _ in normalized_checks[1:]:
        valid = valid & condition
    reasons = [
        F.when(~condition, F.lit(reason))
        for condition, reason in normalized_checks
    ]
    return parsed.withColumn("is_valid", valid).withColumn(
        "error_reason", F.concat_ws(",", *reasons)
    )


def _parse_weather_stream(raw: Any) -> Any:
    from pyspark.sql import functions as F

    parsed = raw.withColumn(
        "event", F.from_json(F.col("raw_payload"), _weather_schema())
    ).select(
        "raw_payload",
        "kafka_topic",
        "kafka_partition",
        "kafka_offset",
        "kafka_timestamp",
        "event.*",
    )
    parsed = parsed.withColumn(
        "observed_at_utc", F.try_to_timestamp("observed_at")
    )
    parsed = parsed.withColumn(
        "fetched_at_utc", F.try_to_timestamp("fetched_at")
    )

    checks = [
        (F.col("schema_version") == 1, "unsupported_schema_version"),
        (
            F.length(F.trim("event_id")).between(1, 191),
            "invalid_event_id",
        ),
        (F.col("observed_at_utc").isNotNull(), "invalid_observed_at"),
        (F.col("fetched_at_utc").isNotNull(), "invalid_fetched_at"),
        (F.col("nx") >= 0, "invalid_nx"),
        (F.col("ny") >= 0, "invalid_ny"),
        (
            F.col("temperature").isNotNull() & (~F.isnan("temperature")),
            "invalid_temperature",
        ),
        (
            (~F.isnan("rainfall_1h")) & (F.col("rainfall_1h") >= 0),
            "invalid_rainfall_1h",
        ),
        (
            F.length(F.trim("source")).between(1, 64),
            "invalid_source",
        ),
    ]
    normalized_checks = [
        (F.coalesce(condition, F.lit(False)), reason)
        for condition, reason in checks
    ]
    valid = normalized_checks[0][0]
    for condition, _ in normalized_checks[1:]:
        valid = valid & condition
    reasons = [
        F.when(~condition, F.lit(reason))
        for condition, reason in normalized_checks
    ]
    return parsed.withColumn("is_valid", valid).withColumn(
        "error_reason", F.concat_ws(",", *reasons)
    )


def _batch_handler(
    *,
    stream_name: str,
    table: str,
    columns: Sequence[str],
    timestamp_renames: Mapping[str, str],
    settings: Settings,
    spark: Any,
) -> Callable[[Any, int], None]:
    from pyspark.sql import functions as F

    def handle(batch: Any, batch_id: int) -> None:
        batch.persist()
        try:
            invalid = batch.filter(~F.col("is_valid"))
            invalid_count = invalid.count()
            if invalid_count:
                (
                    invalid.select(
                        "raw_payload",
                        "error_reason",
                        "kafka_topic",
                        "kafka_partition",
                        "kafka_offset",
                        "kafka_timestamp",
                    )
                    .withColumn("stream_name", F.lit(stream_name))
                    .withColumn("batch_id", F.lit(batch_id))
                    .withColumn("rejected_at", F.current_timestamp())
                    .write.mode("append")
                    .json(f"{settings.dead_letter_root}/{stream_name}")
                )
                LOGGER.warning(
                    "rejected invalid events stream=%s batch_id=%s count=%s",
                    stream_name,
                    batch_id,
                    invalid_count,
                )

            valid = batch.filter(F.col("is_valid"))
            for source, target in timestamp_renames.items():
                # Spark timestamps are instants. Formatting them inside Spark while
                # spark.sql.session.timeZone=UTC avoids Python datetime conversion,
                # which otherwise depends on the driver's operating-system timezone.
                valid = valid.withColumn(
                    source,
                    F.date_format(F.col(target), "yyyy-MM-dd HH:mm:ss.SSSSSS"),
                ).drop(target)
            selected = valid.select(*columns).dropDuplicates(["event_id"])
            written = execute_mysql_upsert(
                selected.toLocalIterator(),
                columns=columns,
                table=table,
                settings=settings,
                jvm=spark.sparkContext._jvm,
            )
            LOGGER.info(
                "micro-batch committed stream=%s batch_id=%s rows=%s invalid=%s",
                stream_name,
                batch_id,
                written,
                invalid_count,
            )
        finally:
            batch.unpersist()

    return handle


def _start_query(
    stream: Any,
    *,
    query_name: str,
    checkpoint: str,
    trigger_seconds: int,
    handler: Callable[[Any, int], None],
) -> Any:
    return (
        stream.writeStream.queryName(query_name)
        .outputMode("append")
        .option("checkpointLocation", checkpoint)
        .trigger(processingTime=f"{trigger_seconds} seconds")
        .foreachBatch(handler)
        .start()
    )


def main() -> None:
    from pyspark.sql import SparkSession

    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = load_settings()
    spark = (
        SparkSession.builder.appName("tashu-kafka-mysql-streaming")
        .config("spark.sql.session.timeZone", "UTC")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel(os.environ.get("SPARK_LOG_LEVEL", "WARN"))

    station_stream = _parse_station_stream(
        _read_topic(spark, settings, settings.station_topic)
    )
    weather_stream = _parse_weather_stream(
        _read_topic(spark, settings, settings.weather_topic)
    )

    queries = [
        _start_query(
            station_stream,
            query_name="tashu-station-kafka-mysql-v2",
            checkpoint=f"{settings.checkpoint_root}/station",
            trigger_seconds=settings.trigger_seconds,
            handler=_batch_handler(
                stream_name="station",
                table=STATION_TABLE,
                columns=STATION_COLUMNS,
                timestamp_renames={"collected_at": "collected_at_utc"},
                settings=settings,
                spark=spark,
            ),
        ),
        _start_query(
            weather_stream,
            query_name="tashu-weather-kafka-mysql-v2",
            checkpoint=f"{settings.checkpoint_root}/weather",
            trigger_seconds=settings.trigger_seconds,
            handler=_batch_handler(
                stream_name="weather",
                table=WEATHER_TABLE,
                columns=WEATHER_COLUMNS,
                timestamp_renames={
                    "observed_at": "observed_at_utc",
                    "fetched_at": "fetched_at_utc",
                },
                settings=settings,
                spark=spark,
            ),
        ),
    ]

    LOGGER.info(
        "streaming started station_topic=%s weather_topic=%s checkpoint=%s",
        settings.station_topic,
        settings.weather_topic,
        settings.checkpoint_root,
    )
    try:
        spark.streams.awaitAnyTermination()
        failed = [query for query in queries if query.exception() is not None]
        if failed:
            raise RuntimeError(f"streaming query failed: {failed[0].exception()}")
    finally:
        for query in queries:
            if query.isActive:
                query.stop()
        spark.stop()


if __name__ == "__main__":
    main()
