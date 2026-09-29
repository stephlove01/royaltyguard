USE royaltyguard;

CREATE TABLE royalty_rows (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    statement_id INT UNSIGNED NOT NULL,
    track_name VARCHAR(255) NOT NULL,
    plays BIGINT NOT NULL,
    territory VARCHAR(100) NOT NULL,
    tier VARCHAR(100) DEFAULT NULL,
    actual_payout DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_royalty_rows_statement
        FOREIGN KEY (statement_id)
        REFERENCES statements(id)
        ON DELETE CASCADE,

    INDEX idx_royalty_rows_statement_id (statement_id)
);
