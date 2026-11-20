USE royaltyguard;

-- TASK-080: Retain the approval/send attempt and the Gmail receipt returned by
-- n8n. `send_uncertain` is a valid status when a network timeout prevents the
-- backend from knowing whether n8n already accepted the email.
ALTER TABLE disputes
    ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL AFTER status,
    ADD COLUMN send_attempted_at TIMESTAMP NULL DEFAULT NULL AFTER approved_at,
    ADD COLUMN provider_message_id VARCHAR(255) NULL AFTER send_attempted_at,
    ADD COLUMN provider_thread_id VARCHAR(255) NULL AFTER provider_message_id,
    ADD COLUMN send_receipt JSON NULL DEFAULT NULL AFTER provider_thread_id,
    ADD INDEX idx_disputes_provider_message_id (provider_message_id);
