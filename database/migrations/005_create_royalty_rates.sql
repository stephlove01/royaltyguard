USE royaltyguard;

CREATE TABLE royalty_rates (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    platform VARCHAR(100) NOT NULL,
    territory VARCHAR(100) DEFAULT NULL,
    rate DECIMAL(10, 6) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE DEFAULT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'demo_seed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_royalty_rates_platform_territory_dates (
        platform,
        territory,
        effective_from,
        effective_to
    )
);
