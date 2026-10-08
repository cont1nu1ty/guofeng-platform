CREATE TABLE IF NOT EXISTS jf_course_publication (
 course_id VARCHAR(64) NOT NULL, publication_version BIGINT NOT NULL, payload JSON NOT NULL,
 published_by BIGINT NULL, published_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 legacy BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(course_id,publication_version),
 CONSTRAINT jf_course_publication_course FOREIGN KEY(course_id) REFERENCES jf_entity(id)
);
CREATE TABLE IF NOT EXISTS jf_course_learning (
 user_id BIGINT NOT NULL, course_id VARCHAR(64) NOT NULL, publication_version BIGINT NOT NULL,
 lessons JSON NOT NULL, quiz_passed BOOLEAN NOT NULL DEFAULT FALSE, best_score INT NULL,
 completed_at TIMESTAMP(3) NULL, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(user_id,course_id,publication_version),
 CONSTRAINT jf_course_learning_publication FOREIGN KEY(course_id,publication_version)
 REFERENCES jf_course_publication(course_id,publication_version)
);
CREATE TABLE IF NOT EXISTS jf_course_attempt (
 id VARCHAR(64) PRIMARY KEY, user_id BIGINT NOT NULL, course_id VARCHAR(64) NOT NULL,
 publication_version BIGINT NOT NULL, answers JSON NOT NULL, score INT NOT NULL, passed BOOLEAN NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_course_attempt_owner(user_id,course_id,publication_version,created_at)
);
CREATE TABLE IF NOT EXISTS jf_education_group (
 id VARCHAR(64) PRIMARY KEY, name VARCHAR(150) NOT NULL, region_id VARCHAR(40) NOT NULL,
 course_id VARCHAR(64) NOT NULL, publication_version BIGINT NOT NULL, cadre_only BOOLEAN NOT NULL DEFAULT FALSE,
 declaration_text TEXT NOT NULL, version BIGINT NOT NULL DEFAULT 1, created_by BIGINT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_education_group_region(region_id,created_at),
 CONSTRAINT jf_education_group_publication FOREIGN KEY(course_id,publication_version)
 REFERENCES jf_course_publication(course_id,publication_version)
);
CREATE TABLE IF NOT EXISTS jf_education_member (
 group_id VARCHAR(64) NOT NULL, user_id BIGINT NOT NULL,
 assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(group_id,user_id), INDEX jf_education_member_user(user_id,group_id),
 CONSTRAINT jf_education_member_group FOREIGN KEY(group_id) REFERENCES jf_education_group(id)
);
CREATE TABLE IF NOT EXISTS jf_education_identity (
 user_id BIGINT PRIMARY KEY, region_id VARCHAR(40) NOT NULL, organization VARCHAR(200) NOT NULL,
 request_note TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending', review_reason TEXT NULL,
 reviewed_by BIGINT NULL, reviewed_at TIMESTAMP(3) NULL, version BIGINT NOT NULL DEFAULT 1,
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_education_identity_region(region_id,status)
);
CREATE TABLE IF NOT EXISTS jf_education_declaration (
 id VARCHAR(64) PRIMARY KEY, group_id VARCHAR(64) NOT NULL, group_version BIGINT NOT NULL,
 user_id BIGINT NOT NULL, text_snapshot TEXT NOT NULL, text_sha256 CHAR(64) NOT NULL,
 confirmed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY jf_education_declaration_once(group_id,group_version,user_id),
 INDEX jf_education_declaration_owner(user_id,confirmed_at),
 CONSTRAINT jf_education_declaration_group FOREIGN KEY(group_id) REFERENCES jf_education_group(id)
);
-- Freeze only already published content. Old learning rows remain historical evidence,
-- and are deliberately NOT copied into version-bound completion or quiz records.
INSERT IGNORE INTO jf_course_publication(course_id,publication_version,payload,published_at,legacy)
 SELECT id,1,payload,updated_at,TRUE FROM jf_entity WHERE kind='course' AND status='已上架';
UPDATE jf_entity SET payload=JSON_SET(payload,'$.publishedVersion',1)
 WHERE kind='course' AND status='已上架' AND JSON_EXTRACT(payload,'$.publishedVersion') IS NULL;
