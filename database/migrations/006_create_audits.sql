USE royaltyguard;

CREATE TABLE audits (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    statement_id INT UNSIGNED NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total_expected DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    total_actual DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    total_difference DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_audits_statement
        FOREIGN KEY (statement_id)
        REFERENCES statements(id)
        ON DELETE CASCADE,

    INDEX idx_audits_statement_id (statement_id),
    INDEX idx_audits_status (status)
);
