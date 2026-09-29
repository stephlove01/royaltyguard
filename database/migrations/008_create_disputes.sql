USE royaltyguard;

CREATE TABLE disputes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    discrepancy_id INT UNSIGNED NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    sent_at TIMESTAMP NULL DEFAULT NULL,
    response_at TIMESTAMP NULL DEFAULT NULL,
    follow_up_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_disputes_discrepancy
        FOREIGN KEY (discrepancy_id)
        REFERENCES discrepancies(id)
        ON DELETE CASCADE,

    INDEX idx_disputes_discrepancy_id (discrepancy_id),
    INDEX idx_disputes_status (status),
    INDEX idx_disputes_follow_up_at (follow_up_at)
);
