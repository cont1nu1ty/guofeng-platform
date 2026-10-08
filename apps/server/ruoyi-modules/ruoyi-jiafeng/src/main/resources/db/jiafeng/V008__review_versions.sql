CREATE TABLE IF NOT EXISTS jf_review_binding (
 revision_id VARCHAR(64) PRIMARY KEY,
 flow_version BIGINT NOT NULL,
 snapshot JSON NOT NULL,
 source VARCHAR(40) NOT NULL,
 flow_instance_id VARCHAR(64) NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT jf_review_binding_revision FOREIGN KEY(revision_id) REFERENCES jf_revision(id)
);
-- Existing instances are read from their recorded flowSnapshot. No historical facts are invented.
ALTER TABLE jf_review_window ADD INDEX jf_review_submission (submission_id,status,due_at_ms);
CREATE TABLE IF NOT EXISTS jf_submission_import (
 source_key VARCHAR(64) PRIMARY KEY,
 submission_id VARCHAR(64) NOT NULL,
 revision_id VARCHAR(64) NOT NULL UNIQUE,
 imported_by BIGINT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT jf_import_submission FOREIGN KEY(submission_id) REFERENCES jf_entity(id),
 CONSTRAINT jf_import_revision FOREIGN KEY(revision_id) REFERENCES jf_revision(id)
);
