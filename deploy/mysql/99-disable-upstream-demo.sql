-- Imported upstream example users are never login-capable in this deployment.
-- Jiafeng's versioned business initializer creates explicit development users.
UPDATE sys_user SET status = '1';
UPDATE sys_config SET config_value = 'false' WHERE config_key = 'sys.account.registerUser';
CREATE TABLE jf_bootstrap_ready (id INT PRIMARY KEY, completed INT NOT NULL);
INSERT INTO jf_bootstrap_ready (id, completed) VALUES (1, 1);
