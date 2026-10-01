USE royaltyguard;

ALTER TABLE statements
    ADD COLUMN source_file_id VARCHAR(255) NULL AFTER source_metadata;

CREATE TEMPORARY TABLE n8n_statement_source_keys AS
SELECT MIN(id) AS statement_id,
    JSON_UNQUOTE(JSON_EXTRACT(source_metadata, '$.sourceFileId')) AS source_file_id
FROM statements
WHERE source_metadata IS NOT NULL
    AND JSON_EXTRACT(source_metadata, '$.sourceFileId') IS NOT NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(source_metadata, '$.sourceFileId')) <> ''
GROUP BY JSON_UNQUOTE(JSON_EXTRACT(source_metadata, '$.sourceFileId'));

UPDATE statements AS s
INNER JOIN n8n_statement_source_keys AS source_keys ON source_keys.statement_id = s.id
SET s.source_file_id = source_keys.source_file_id;

DROP TEMPORARY TABLE n8n_statement_source_keys;

ALTER TABLE statements
    ADD UNIQUE KEY uq_statements_source_file_id (source_file_id);

ALTER TABLE audits
    ADD UNIQUE KEY uq_audits_statement_id (statement_id);

ALTER TABLE discrepancies
    ADD UNIQUE KEY uq_discrepancies_audit_royalty_row (audit_id, royalty_row_id);