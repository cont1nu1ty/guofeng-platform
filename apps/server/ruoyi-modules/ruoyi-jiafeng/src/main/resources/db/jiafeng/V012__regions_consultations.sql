CREATE TABLE IF NOT EXISTS jf_region_node (
 id VARCHAR(64) PRIMARY KEY,
 parent_id VARCHAR(64) NOT NULL,
 province_id VARCHAR(40) NOT NULL,
 level INT NOT NULL,
 name VARCHAR(100) NOT NULL,
 name_en VARCHAR(200) NOT NULL DEFAULT '',
 official_code VARCHAR(40) NOT NULL DEFAULT '',
 source VARCHAR(1000) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 version BIGINT NOT NULL DEFAULT 1,
 INDEX jf_region_parent(parent_id,enabled,name),
 INDEX jf_region_province(province_id,level)
);
CREATE TABLE IF NOT EXISTS jf_venue_area (
 venue_id VARCHAR(64) PRIMARY KEY,
 area_id VARCHAR(64) NOT NULL,
 INDEX jf_venue_area_index(area_id),
 CONSTRAINT jf_venue_area_venue FOREIGN KEY(venue_id) REFERENCES jf_entity(id),
 CONSTRAINT jf_venue_area_node FOREIGN KEY(area_id) REFERENCES jf_region_node(id)
);
CREATE TABLE IF NOT EXISTS jf_consultation_event (
 id VARCHAR(64) PRIMARY KEY,
 claim_id VARCHAR(64) NOT NULL,
 actor_id BIGINT NOT NULL,
 stage VARCHAR(24) NOT NULL,
 note TEXT NOT NULL,
 quote_amount DECIMAL(14,2) NULL,
 quote_description TEXT NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_consultation_history(claim_id,created_at),
 CONSTRAINT jf_consultation_claim FOREIGN KEY(claim_id) REFERENCES jf_entity(id)
);
