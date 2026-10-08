CREATE TABLE IF NOT EXISTS jf_engagement (
 owner_id BIGINT NOT NULL, target_kind VARCHAR(30) NOT NULL, target_id VARCHAR(64) NOT NULL,
 action VARCHAR(20) NOT NULL, day_key DATE NOT NULL, region_id VARCHAR(40) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(owner_id,target_kind,target_id,action,day_key),
 INDEX jf_engagement_statistics(region_id,created_at,action)
);
