USE royaltyguard;

ALTER TABLE statements
    ADD COLUMN source_metadata JSON NULL AFTER storage_location;