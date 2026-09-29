USE royaltyguard;

CREATE TABLE statements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    artist_id INT UNSIGNED NOT NULL,
    platform VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    statement_period VARCHAR(100) NOT NULL,
    storage_location TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_statements_artist
        FOREIGN KEY (artist_id)
        REFERENCES artists(id)
        ON DELETE CASCADE,

    INDEX idx_statements_artist_id (artist_id),
    INDEX idx_statements_status (status)
);
