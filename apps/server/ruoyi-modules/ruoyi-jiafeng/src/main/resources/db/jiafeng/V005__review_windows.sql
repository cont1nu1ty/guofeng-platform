CREATE TABLE IF NOT EXISTS jf_review_window (
 task_id VARCHAR(64) PRIMARY KEY,
 submission_id VARCHAR(64) NOT NULL,
 owner_id BIGINT NOT NULL,
 manager_id BIGINT NOT NULL,
 region_id VARCHAR(40) NOT NULL,
 status VARCHAR(40) NOT NULL,
 starts_at_ms BIGINT NOT NULL,
 due_at_ms BIGINT NOT NULL,
 window_version BIGINT NOT NULL DEFAULT 1,
 due_soon_checked BOOLEAN NOT NULL DEFAULT FALSE,
 overdue_checked BOOLEAN NOT NULL DEFAULT FALSE,
 INDEX jf_review_due(status,due_at_ms,overdue_checked),
 INDEX jf_review_start(status,starts_at_ms,due_at_ms),
 INDEX jf_review_owner(owner_id,status,due_at_ms),
 INDEX jf_review_manager(manager_id,status,due_at_ms),
 INDEX jf_review_region(region_id,status,due_at_ms),
 CONSTRAINT jf_review_window_task FOREIGN KEY(task_id) REFERENCES jf_entity(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS jf_review_delivery (
 task_id VARCHAR(64) NOT NULL,
 window_version BIGINT NOT NULL,
 phase VARCHAR(24) NOT NULL,
 recipient_id BIGINT NOT NULL,
 notification_id VARCHAR(64) NOT NULL UNIQUE,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(task_id,window_version,phase,recipient_id),
 INDEX jf_review_recipient(recipient_id,created_at),
 CONSTRAINT jf_review_delivery_task FOREIGN KEY(task_id) REFERENCES jf_entity(id) ON DELETE CASCADE,
 CONSTRAINT jf_review_delivery_notification FOREIGN KEY(notification_id) REFERENCES jf_entity(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS jf_review_reminder_state (
 id INT PRIMARY KEY,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 initialized BOOLEAN NOT NULL DEFAULT FALSE,
 cutoff_ms BIGINT NOT NULL
);
INSERT IGNORE INTO jf_review_reminder_state(id,cutoff_ms)
 VALUES(1,UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000);
INSERT IGNORE INTO jf_review_window(task_id,submission_id,owner_id,manager_id,region_id,status,starts_at_ms,due_at_ms,window_version)
SELECT id,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.submissionId')),owner_id,
 COALESCE(JSON_EXTRACT(payload,'$.managerId'),0),region_id,status,
 COALESCE(TIMESTAMPDIFF(MICROSECOND,'1970-01-01 00:00:00',
   CAST(REPLACE(LEFT(REGEXP_SUBSTR(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.startsAt')),
                            JSON_UNQUOTE(JSON_EXTRACT(payload,'$.assignedAt'))),
                            '^[0-9-]{10}[T ][0-9:]{8}([.][0-9]+)?'),23),'T',' ') AS DATETIME(3)))/1000,
          UNIX_TIMESTAMP(created_at)*1000),
 TIMESTAMPDIFF(MICROSECOND,'1970-01-01 00:00:00',
   CAST(REPLACE(LEFT(REGEXP_SUBSTR(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.dueAt')),
                            '^[0-9-]{10}[T ][0-9:]{8}([.][0-9]+)?'),23),'T',' ') AS DATETIME(3)))/1000,
 COALESCE(JSON_EXTRACT(payload,'$.windowVersion'),1)
FROM jf_entity WHERE kind='task';
