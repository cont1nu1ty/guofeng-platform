CREATE TABLE IF NOT EXISTS jf_job (
 id VARCHAR(64) PRIMARY KEY, owner_id BIGINT NOT NULL, region_id VARCHAR(40) NOT NULL,
 kind VARCHAR(40) NOT NULL, permission_key VARCHAR(80) NOT NULL, status VARCHAR(20) NOT NULL,
 request JSON NOT NULL, snapshot JSON NOT NULL, result JSON NULL, error_code VARCHAR(100) NULL,
 attempts INT NOT NULL DEFAULT 0, generation BIGINT NOT NULL DEFAULT 0,
 available_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), lease_until TIMESTAMP(3) NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_job_queue(status,available_at), INDEX jf_job_owner(owner_id,created_at)
);
CREATE TABLE IF NOT EXISTS jf_notification_delivery (
 delivery_key VARCHAR(150) PRIMARY KEY, owner_id BIGINT NOT NULL, notification_id VARCHAR(64) NOT NULL,
 kind VARCHAR(30) NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS jf_report_period (
 owner_id BIGINT NOT NULL, period_key VARCHAR(30) NOT NULL, job_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(owner_id,period_key)
);
CREATE TABLE IF NOT EXISTS jf_delivery_preference (
 owner_id BIGINT PRIMARY KEY, digest VARCHAR(10) NOT NULL DEFAULT 'off', draft_notice BOOLEAN NOT NULL DEFAULT TRUE,
 reports JSON NOT NULL, enabled_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS jf_scheduled_delivery (
 delivery_key VARCHAR(150) PRIMARY KEY, owner_id BIGINT NOT NULL, region_id VARCHAR(40) NOT NULL,
 kind VARCHAR(30) NOT NULL, payload JSON NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'queued', attempts INT NOT NULL DEFAULT 0,
 error_code VARCHAR(100), available_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_scheduled_queue(status,available_at)
);
SET @jf_page_index = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='jf_entity' AND index_name='jf_entity_created_page')=0,'CREATE INDEX jf_entity_created_page ON jf_entity(kind,region_id,created_at,id)','SELECT 1');
PREPARE jf_page_stmt FROM @jf_page_index;
EXECUTE jf_page_stmt;
DEALLOCATE PREPARE jf_page_stmt;
