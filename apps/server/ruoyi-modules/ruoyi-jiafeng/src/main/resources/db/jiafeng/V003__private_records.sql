-- DDL commits independently in MySQL; column guards permit interrupted migration retry.

SET @jf_private_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='jf_file' AND column_name='purpose'),
  'SELECT 1', 'ALTER TABLE jf_file ADD COLUMN purpose VARCHAR(24) NOT NULL DEFAULT ''manuscript''');
PREPARE jf_private_statement FROM @jf_private_ddl;
EXECUTE jf_private_statement;
DEALLOCATE PREPARE jf_private_statement;

SET @jf_private_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='jf_file' AND column_name='duration_ms'),
  'SELECT 1', 'ALTER TABLE jf_file ADD COLUMN duration_ms BIGINT NULL');
PREPARE jf_private_statement FROM @jf_private_ddl;
EXECUTE jf_private_statement;
DEALLOCATE PREPARE jf_private_statement;

SET @jf_private_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='jf_file' AND column_name='original_name'),
  'SELECT 1', 'ALTER TABLE jf_file ADD COLUMN original_name VARCHAR(255) NULL');
PREPARE jf_private_statement FROM @jf_private_ddl;
EXECUTE jf_private_statement;
DEALLOCATE PREPARE jf_private_statement;

SET @jf_private_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
    AND table_name='jf_file' AND column_name='source_sha256'),
  'SELECT 1', 'ALTER TABLE jf_file ADD COLUMN source_sha256 VARCHAR(64) NULL');
PREPARE jf_private_statement FROM @jf_private_ddl;
EXECUTE jf_private_statement;
DEALLOCATE PREPARE jf_private_statement;

UPDATE jf_file SET purpose='media' WHERE file_type IN ('audio','video') AND purpose='manuscript';
