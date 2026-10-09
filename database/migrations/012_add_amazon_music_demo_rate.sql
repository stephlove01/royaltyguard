USE royaltyguard;

-- Additive demo-rate row for Amazon Music. Fictional/capstone only — not a
-- real platform payout rate. Safe to rerun: unique key on platform +
-- territory + effective dates plus ON DUPLICATE KEY UPDATE.

INSERT INTO royalty_rates (platform, territory, rate, currency, effective_from, effective_to, source)
VALUES
    ('Amazon Music', 'NG', 0.005000, 'NGN', '2026-01-01', '2026-12-31', 'demo_seed')
ON DUPLICATE KEY UPDATE
    rate = VALUES(rate),
    currency = VALUES(currency),
    effective_from = VALUES(effective_from),
    effective_to = VALUES(effective_to),
    source = VALUES(source);
