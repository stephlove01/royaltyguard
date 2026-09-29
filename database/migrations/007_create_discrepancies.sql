USE royaltyguard;

CREATE TABLE discrepancies (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    audit_id INT UNSIGNED NOT NULL,
    royalty_row_id INT UNSIGNED NOT NULL,
    expected_amount DECIMAL(18, 2) NOT NULL,
    actual_amount DECIMAL(18, 2) NOT NULL,
    difference DECIMAL(18, 2) NOT NULL,
    threshold DECIMAL(18, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_discrepancies_audit
        FOREIGN KEY (audit_id)
        REFERENCES audits(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_discrepancies_royalty_row
        FOREIGN KEY (royalty_row_id)
        REFERENCES royalty_rows(id)
        ON DELETE CASCADE,

    INDEX idx_discrepancies_audit_id (audit_id),
    INDEX idx_discrepancies_status (status)
);
