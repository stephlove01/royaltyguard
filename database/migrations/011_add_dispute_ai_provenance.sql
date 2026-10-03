USE royaltyguard;

-- TASK-076: AI dispute draft provenance.
-- Additive, nullable columns so existing manually authored disputes keep
-- working (default source 'manual'). These columns record that a draft was
-- generated from verified persisted facts and which fact paths were used.

ALTER TABLE disputes
    ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual' AFTER body,
    ADD COLUMN facts_used JSON NULL DEFAULT NULL AFTER source,
    ADD COLUMN missing_information JSON NULL DEFAULT NULL AFTER facts_used,
    ADD COLUMN generated_at TIMESTAMP NULL DEFAULT NULL AFTER missing_information;
