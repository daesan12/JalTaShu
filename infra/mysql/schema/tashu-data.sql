SET SESSION time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS `tashu_data`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tashu_data`.`station_availability` (
  `event_id` VARCHAR(191) NOT NULL,
  `schema_version` SMALLINT UNSIGNED NOT NULL,
  `snapshot_id` VARCHAR(64) NOT NULL,
  `station_count` MEDIUMINT UNSIGNED NOT NULL,
  `collected_at` TIMESTAMP(6) NOT NULL,
  `station_id` VARCHAR(64) NOT NULL,
  `station_name` VARCHAR(255) NOT NULL,
  `lat` DOUBLE NOT NULL,
  `lon` DOUBLE NOT NULL,
  `bikes` INT UNSIGNED NOT NULL,
  `ingested_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`event_id`),
  UNIQUE KEY `uq_snapshot_station` (`snapshot_id`, `station_id`),
  KEY `idx_station_collected` (`station_id`, `collected_at` DESC),
  KEY `idx_snapshot` (`snapshot_id`),
  KEY `idx_collected_at` (`collected_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tashu_data`.`weather_observation` (
  `event_id` VARCHAR(191) NOT NULL,
  `schema_version` SMALLINT UNSIGNED NOT NULL,
  `observed_at` TIMESTAMP(6) NOT NULL,
  `fetched_at` TIMESTAMP(6) NOT NULL,
  `nx` SMALLINT UNSIGNED NOT NULL,
  `ny` SMALLINT UNSIGNED NOT NULL,
  `temperature` DOUBLE NOT NULL,
  `rainfall_1h` DOUBLE NOT NULL,
  `source` VARCHAR(64) NOT NULL,
  `ingested_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`event_id`),
  UNIQUE KEY `uq_weather_observation` (`observed_at`, `nx`, `ny`),
  KEY `idx_observed_at` (`observed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
