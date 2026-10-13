-- MySQL owns private tasks and revocable knowledge; only the internal worker calls models.
CREATE TABLE IF NOT EXISTS jf_ai_task (
 id VARCHAR(64) PRIMARY KEY, owner_id BIGINT NOT NULL, region_id VARCHAR(40) NOT NULL,
 mode VARCHAR(24) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'queued',
 management BOOLEAN NOT NULL DEFAULT FALSE, request JSON NOT NULL, response JSON NULL,
 sources JSON NULL, error_code VARCHAR(64) NOT NULL DEFAULT '', error_message VARCHAR(255) NOT NULL DEFAULT '',
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 started_at TIMESTAMP(3) NULL, completed_at TIMESTAMP(3) NULL,
 INDEX jf_ai_task_queue(status,created_at), INDEX jf_ai_task_owner(owner_id,created_at),
 INDEX jf_ai_task_region(region_id,created_at)
);
CREATE TABLE IF NOT EXISTS jf_ai_chunk (
 id VARCHAR(80) PRIMARY KEY, document_id VARCHAR(64) NOT NULL, source_version BIGINT NOT NULL,
 audience VARCHAR(16) NOT NULL, region_id VARCHAR(40) NOT NULL,
 language VARCHAR(8) NOT NULL DEFAULT 'zh', ordinal INT NOT NULL,
 title VARCHAR(200) NOT NULL, body MEDIUMTEXT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY jf_ai_chunk_version(document_id,source_version,ordinal),
 INDEX jf_ai_chunk_scope(audience,region_id,language),
 FULLTEXT KEY jf_ai_chunk_text(title,body) WITH PARSER ngram,
 CONSTRAINT jf_ai_chunk_document FOREIGN KEY(document_id) REFERENCES jf_entity(id)
);
