-- Retain authorization of original attachments across immutable manuscript revisions.
-- Both statements are restartable after MySQL's implicit DDL commit.
CREATE TABLE IF NOT EXISTS jf_revision_file (
 revision_id VARCHAR(64) NOT NULL,
 file_id VARCHAR(64) NOT NULL,
 PRIMARY KEY(revision_id,file_id),
 INDEX jf_revision_file_lookup(file_id),
 CONSTRAINT jf_revision_file_revision FOREIGN KEY(revision_id) REFERENCES jf_revision(id),
 CONSTRAINT jf_revision_file_object FOREIGN KEY(file_id) REFERENCES jf_file(id)
);
INSERT IGNORE INTO jf_revision_file(revision_id,file_id)
 SELECT r.id,f.id FROM jf_revision r
 JOIN JSON_TABLE(r.payload, '$.attachments[*]' COLUMNS(file_id VARCHAR(64) PATH '$.fileId')) a
 JOIN jf_file f ON f.id=a.file_id;
