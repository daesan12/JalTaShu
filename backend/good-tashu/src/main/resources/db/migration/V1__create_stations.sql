CREATE TABLE IF NOT EXISTS `stations` (
    `station_id` varchar(20) NOT NULL,
    `name` varchar(255) NOT NULL,
    `latitude` decimal(10, 6) NULL,
    `longitude` decimal(10, 6) NULL,
    `address` varchar(255) NULL,
    PRIMARY KEY (`station_id`)
);
