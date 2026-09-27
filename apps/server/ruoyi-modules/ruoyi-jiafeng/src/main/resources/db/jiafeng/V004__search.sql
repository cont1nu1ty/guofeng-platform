-- Search is a rebuildable projection. This row serializes generations in business transactions.
CREATE TABLE IF NOT EXISTS jf_search_state (
 id TINYINT NOT NULL PRIMARY KEY,
 installation_id VARCHAR(64) NOT NULL,
 cursor_secret VARCHAR(64) NOT NULL,
 committed_generation BIGINT NOT NULL DEFAULT 0,
 indexed_generation BIGINT NOT NULL DEFAULT -1,
 index_name VARCHAR(128) NOT NULL DEFAULT '',
 index_uuid VARCHAR(128) NOT NULL DEFAULT '',
 rebuild_requested BOOLEAN NOT NULL DEFAULT TRUE,
 status VARCHAR(32) NOT NULL DEFAULT 'starting',
 last_error VARCHAR(255) NOT NULL DEFAULT '',
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);
INSERT IGNORE INTO jf_search_state(id,installation_id,cursor_secret)
 VALUES(1,REPLACE(UUID(),'-',''),CONCAT(REPLACE(UUID(),'-',''),REPLACE(UUID(),'-','')));
CREATE TABLE IF NOT EXISTS jf_search_outbox (
 generation BIGINT NOT NULL PRIMARY KEY,
 entity_id VARCHAR(64) NOT NULL,
 entity_kind VARCHAR(32) NOT NULL,
 document JSON NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
