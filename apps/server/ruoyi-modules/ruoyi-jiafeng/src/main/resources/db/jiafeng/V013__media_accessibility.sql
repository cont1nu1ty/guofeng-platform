CREATE TABLE IF NOT EXISTS jf_media_accessibility (
  media_id VARCHAR(80) NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  draft JSON NOT NULL,
  published JSON NULL,
  updated_by BIGINT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  published_at DATETIME(3) NULL,
  PRIMARY KEY (media_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
