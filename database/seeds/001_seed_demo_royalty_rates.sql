USE royaltyguard;

-- Fictional/demo royalty rates only. Not real platform rates.
-- Safe to run more than once: inserts are prevented by a unique key on platform + territory + effective dates.

INSERT INTO royalty_rates (platform, territory, rate, currency, effective_from, effective_to, source)
VALUES
    ('Spotify', 'NG', 0.004000, 'NGN', '2026-01-01', '2026-12-31', 'demo_seed')
ON DUPLICATE KEY UPDATE
    rate = VALUES(rate),
    currency = VALUES(currency),
    effective_from = VALUES(effective_from),
    effective_to = VALUES(effective_to),
    source = VALUES(source);

INSERT INTO royalty_rates (platform, territory, rate, currency, effective_from, effective_to, source)
VALUES
    ('Apple Music', 'NG', 0.006000, 'NGN', '2026-01-01', '2026-12-31', 'demo_seed')
ON DUPLICATE KEY UPDATE
    rate = VALUES(rate),
    currency = VALUES(currency),
    effective_from = VALUES(effective_from),
    effective_to = VALUES(effective_to),
    source = VALUES(source);

INSERT INTO royalty_rates (platform, territory, rate, currency, effective_from, effective_to, source)
VALUES
    ('YouTube Music', 'NG', 0.003000, 'NGN', '2026-01-01', '2026-12-31', 'demo_seed')
ON DUPLICATE KEY UPDATE
    rate = VALUES(rate),
    currency = VALUES(currency),
    effective_from = VALUES(effective_from),
    effective_to = VALUES(effective_to),
    source = VALUES(source);

INSERT INTO royalty_rates (platform, territory, rate, currency, effective_from, effective_to, source)
VALUES
    ('Audiomack', 'NG', 0.002000, 'NGN', '2026-01-01', '2026-12-31', 'demo_seed')
ON DUPLICATE KEY UPDATE
    rate = VALUES(rate),
    currency = VALUES(currency),
    effective_from = VALUES(effective_from),
    effective_to = VALUES(effective_to),
    source = VALUES(source);
