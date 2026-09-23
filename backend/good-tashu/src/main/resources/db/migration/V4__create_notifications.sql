CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body VARCHAR(500) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (notification_id),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users (user_id)
        ON DELETE CASCADE,
    INDEX idx_notifications_user_created (user_id, created_at, notification_id)
);
