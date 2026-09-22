import os

from pyspark.sql import SparkSession


required = (
    "TASHU_DATA_DB_JDBC_URL",
    "TASHU_DATA_DB_USER",
    "TASHU_DATA_DB_PASSWORD",
    "TASHU_DATA_DB_DRIVER",
)
missing = [name for name in required if not os.environ.get(name)]
if missing:
    raise RuntimeError(f"missing database environment: {', '.join(missing)}")

spark = SparkSession.builder.appName("tashu-mysql-access-smoke-test").getOrCreate()

query = """
(
  SELECT
    @@session.time_zone AS session_timezone,
    (SELECT COUNT(*) FROM station_availability) AS station_rows,
    (SELECT COUNT(*) FROM weather_observation) AS weather_rows
) AS access_check
"""

result = (
    spark.read.format("jdbc")
    .option("url", os.environ["TASHU_DATA_DB_JDBC_URL"])
    .option("driver", os.environ["TASHU_DATA_DB_DRIVER"])
    .option("user", os.environ["TASHU_DATA_DB_USER"])
    .option("password", os.environ["TASHU_DATA_DB_PASSWORD"])
    .option("dbtable", query)
    .load()
    .collect()
)

if len(result) != 1 or result[0]["session_timezone"] != "+00:00":
    raise RuntimeError(f"unexpected MySQL session result: {result}")

print(
    "TASHU_MYSQL_JDBC_SMOKE_OK "
    f"timezone={result[0]['session_timezone']} "
    f"station_rows={result[0]['station_rows']} "
    f"weather_rows={result[0]['weather_rows']}"
)

spark.stop()
