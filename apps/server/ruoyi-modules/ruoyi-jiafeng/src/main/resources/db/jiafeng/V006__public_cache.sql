-- Redis only contains rebuildable projections. Business writes and generations commit together.
CREATE TABLE IF NOT EXISTS jf_public_cache_state (
 id TINYINT NOT NULL PRIMARY KEY,
 epoch VARCHAR(36) NOT NULL,
 catalog_generation BIGINT NOT NULL DEFAULT 0,
 stats_generation BIGINT NOT NULL DEFAULT 0
);
INSERT IGNORE INTO jf_public_cache_state(id,epoch) VALUES(1,UUID());
-- DDL may commit before the migration receipt; retry after interruption must remain safe.
SET @jf_public_index_sql = IF(
 (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=DATABASE() AND table_name='jf_entity' AND index_name='jf_entity_public_status')=0,
 'CREATE INDEX jf_entity_public_status ON jf_entity(kind,status,created_at,id)', 'SELECT 1');
PREPARE jf_public_index_stmt FROM @jf_public_index_sql;
EXECUTE jf_public_index_stmt;
DEALLOCATE PREPARE jf_public_index_stmt;
