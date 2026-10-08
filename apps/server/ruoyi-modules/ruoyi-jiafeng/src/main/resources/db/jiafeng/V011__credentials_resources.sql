CREATE TABLE IF NOT EXISTS jf_copyright_confirmation (
 id VARCHAR(64) PRIMARY KEY, owner_id BIGINT NOT NULL, submission_id VARCHAR(64) NOT NULL,
 revision_id VARCHAR(64) NOT NULL, agreement_version VARCHAR(60) NOT NULL,
 agreement_text TEXT NOT NULL, agreement_hash VARCHAR(64) NOT NULL,
 accepted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY jf_copyright_once(submission_id,revision_id,agreement_version),
 INDEX jf_copyright_owner(owner_id,accepted_at)
);
CREATE TABLE IF NOT EXISTS jf_certificate (
 id VARCHAR(64) PRIMARY KEY, certificate_no VARCHAR(60) NOT NULL UNIQUE,
 owner_id BIGINT NOT NULL, region_id VARCHAR(40) NOT NULL, kind VARCHAR(24) NOT NULL,
 source_key VARCHAR(200) NOT NULL, active_source_key VARCHAR(200) NULL UNIQUE,
 source_snapshot JSON NOT NULL, title VARCHAR(160) NOT NULL, issuer VARCHAR(120) NOT NULL,
 file_id VARCHAR(64) NOT NULL, file_hash VARCHAR(64) NOT NULL,
 verify_token VARCHAR(64) NOT NULL UNIQUE, status VARCHAR(16) NOT NULL DEFAULT 'issued',
 issued_by BIGINT NOT NULL, issued_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 revoked_by BIGINT NULL, revoked_at TIMESTAMP(3) NULL, revoke_reason VARCHAR(1000) NULL,
 version BIGINT NOT NULL DEFAULT 1,
 INDEX jf_certificate_owner(owner_id,issued_at), INDEX jf_certificate_region(region_id,status,issued_at)
);
CREATE TABLE IF NOT EXISTS jf_resource (
 id VARCHAR(64) PRIMARY KEY, owner_id BIGINT NOT NULL, region_id VARCHAR(40) NOT NULL,
 title VARCHAR(160) NOT NULL, description VARCHAR(2000) NOT NULL, file_id VARCHAR(64) NOT NULL,
 license_text VARCHAR(4000) NOT NULL, attribution VARCHAR(500) NOT NULL,
 audience VARCHAR(24) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'draft',
 version BIGINT NOT NULL DEFAULT 1,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_resource_catalog(status,audience,region_id,updated_at)
);
