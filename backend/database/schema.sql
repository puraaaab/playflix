CREATE DATABASE IF NOT EXISTS playflix;
USE playflix;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  subscription_plan VARCHAR(40) NOT NULL DEFAULT 'free',
  subscription_status ENUM('inactive', 'active', 'past_due') NOT NULL DEFAULT 'inactive',
  refresh_token_hash VARCHAR(255) DEFAULT NULL,
  totp_secret VARCHAR(255) DEFAULT NULL,
  totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS videos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  genre VARCHAR(80) NOT NULL,
  maturity_rating VARCHAR(10) NOT NULL DEFAULT '13+',
  thumbnail_url VARCHAR(500) DEFAULT NULL,
  video_path VARCHAR(500) DEFAULT NULL,
  is_premium TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_code VARCHAR(40) NOT NULL,
  amount_paise INT UNSIGNED NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  razorpay_order_id VARCHAR(120) NOT NULL,
  razorpay_payment_id VARCHAR(120) DEFAULT NULL,
  razorpay_signature VARCHAR(255) DEFAULT NULL,
  status ENUM('created', 'verified', 'failed') NOT NULL DEFAULT 'created',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_user_id (user_id),
  KEY idx_payments_order_id (razorpay_order_id),
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED DEFAULT NULL,
  event_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(64) DEFAULT NULL,
  details JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_actor (actor_user_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_video_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  action_type ENUM('watchlist', 'favorite', 'like', 'dislike') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_video_action (user_id, video_id, action_type),
  KEY idx_user_video_action_user (user_id),
  KEY idx_user_video_action_video (video_id),
  CONSTRAINT fk_user_video_action_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_video_action_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS watch_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  video_id BIGINT UNSIGNED NOT NULL,
  last_position_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_watch_history_user_video (user_id, video_id),
  KEY idx_watch_history_user (user_id),
  KEY idx_watch_history_last_watched (last_watched_at),
  CONSTRAINT fk_watch_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_watch_history_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS request_nonces (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  nonce_hash VARCHAR(255) NOT NULL UNIQUE,
  timestamp INT UNSIGNED NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_nonces_user (user_id),
  KEY idx_nonces_expires (expires_at),
  CONSTRAINT fk_nonces_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED,
  ip_address VARCHAR(64) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  backoff_level INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until TIMESTAMP DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rate_limit_user (user_id),
  KEY idx_rate_limit_ip (ip_address),
  KEY idx_rate_limit_endpoint (endpoint),
  CONSTRAINT fk_rate_limit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_key_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED,
  session_key_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMP DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  KEY idx_session_history_user (user_id),
  KEY idx_session_history_expires (expires_at),
  CONSTRAINT fk_session_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO videos (title, slug, description, genre, maturity_rating, thumbnail_url, video_path, is_premium) VALUES
('Midnight Circuit', 'midnight-circuit', 'A heist thriller set in a neon city where every camera is a witness.', 'Thriller', '16+', NULL, './media/midnight-circuit.mp4', 1),
('Glass Harbor', 'glass-harbor', 'A family drama with expensive secrets under calm water.', 'Drama', '13+', NULL, './media/glass-harbor.mp4', 0),
('Neon Atlas', 'neon-atlas', 'A globe-spanning sci-fi chase through corporate-owned weather systems.', 'Sci-Fi', '16+', NULL, './media/neon-atlas.mp4', 1),
('Sunday Static', 'sunday-static', 'A sharp comedy about a broadcast station that cannot stop telling the truth.', 'Comedy', '13+', NULL, './media/sunday-static.mp4', 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);
