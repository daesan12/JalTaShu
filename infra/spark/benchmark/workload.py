#!/usr/bin/env python3
"""Deterministic Spark workload for local, one-worker and two-worker comparison."""

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from pyspark.sql import SparkSession, functions as F


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True, choices=("local", "one-worker", "two-workers"))
    parser.add_argument("--rows", required=True, type=int)
    parser.add_argument("--partitions", required=True, type=int)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.rows <= 0 or args.partitions <= 0:
        parser.error("rows and partitions must be positive")
    return args


def main() -> None:
    args = parse_args()
    spark = SparkSession.builder.appName(f"tashu-spark-benchmark-{args.label}").getOrCreate()
    spark.sparkContext.setLogLevel("WARN")

    started_at = datetime.now(timezone.utc)
    started = time.perf_counter()
    rows = spark.range(0, args.rows, numPartitions=args.partitions)
    aggregates = (
        rows.select(
            (F.col("id") % F.lit(1374)).alias("station_id"),
            ((F.col("id") / F.lit(1374)).cast("long") % F.lit(96)).alias("time_bucket"),
            F.pmod(F.xxhash64("id"), F.lit(1000)).alias("metric"),
        )
        .groupBy("station_id", "time_bucket")
        .agg(
            F.count(F.lit(1)).alias("row_count"),
            F.sum("metric").alias("metric_sum"),
            F.max("metric").alias("metric_max"),
        )
    )
    checksum_row = aggregates.agg(
        F.count(F.lit(1)).alias("group_count"),
        F.sum("row_count").alias("row_count"),
        F.sum("metric_sum").alias("metric_sum"),
        F.sum("metric_max").alias("metric_max_sum"),
    ).first()
    elapsed_seconds = round(time.perf_counter() - started, 3)

    result = {
        "label": args.label,
        "rows": args.rows,
        "partitions": args.partitions,
        "default_parallelism": spark.sparkContext.defaultParallelism,
        "group_count": checksum_row["group_count"],
        "row_count": checksum_row["row_count"],
        "metric_sum": checksum_row["metric_sum"],
        "metric_max_sum": checksum_row["metric_max_sum"],
        "elapsed_seconds": elapsed_seconds,
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "spark_version": spark.version,
    }
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, sort_keys=True) + "\n", encoding="utf-8")
    print("TASHU_SPARK_BENCHMARK_RESULT=" + json.dumps(result, sort_keys=True))
    spark.stop()


if __name__ == "__main__":
    main()
