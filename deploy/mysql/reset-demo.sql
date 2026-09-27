-- Local demo lifecycle only. deploy/dev verifies project ownership, stops all
-- writers and saves a checked full backup before executing this transaction.
-- Preserve migration/bootstrap markers and upstream dictionaries/menus/config.
START TRANSACTION;

CREATE TEMPORARY TABLE reset_jf_accounts AS SELECT user_id FROM jf_account;
CREATE TEMPORARY TABLE reset_jf_names AS
  SELECT u.user_name FROM sys_user u JOIN reset_jf_accounts a ON a.user_id=u.user_id;
CREATE TEMPORARY TABLE reset_jf_definitions AS
  SELECT id FROM flow_definition WHERE LEFT(flow_code,16)='jiafeng_review_v';
CREATE TEMPORARY TABLE reset_jf_instances AS
  SELECT i.id FROM flow_instance i JOIN reset_jf_definitions d ON d.id=i.definition_id;
CREATE TEMPORARY TABLE reset_jf_tasks AS
  SELECT t.id FROM flow_task t JOIN reset_jf_definitions d ON d.id=t.definition_id;
INSERT INTO reset_jf_tasks
  SELECT t.id FROM flow_his_task t JOIN reset_jf_definitions d ON d.id=t.definition_id;
INSERT INTO reset_jf_tasks
  SELECT t.task_id FROM flow_his_task t JOIN reset_jf_definitions d ON d.id=t.definition_id;

DELETE u FROM flow_user u JOIN reset_jf_tasks t ON t.id=u.associated;
-- Some historical terminated tasks leave handler records after their task row
-- disappears. Remove handlers for the accounts being recreated as well.
DELETE u FROM flow_user u JOIN reset_jf_accounts a ON CAST(a.user_id AS CHAR)=u.processed_by;
DELETE e FROM flow_instance_biz_ext e JOIN reset_jf_instances i ON i.id=e.instance_id;
DELETE t FROM flow_his_task t JOIN reset_jf_definitions d ON d.id=t.definition_id;
DELETE t FROM flow_task t JOIN reset_jf_definitions d ON d.id=t.definition_id;
DELETE i FROM flow_instance i JOIN reset_jf_definitions d ON d.id=i.definition_id;
DELETE s FROM flow_skip s JOIN reset_jf_definitions d ON d.id=s.definition_id;
DELETE n FROM flow_node n JOIN reset_jf_definitions d ON d.id=n.definition_id;
DELETE d FROM flow_definition d JOIN reset_jf_definitions r ON r.id=d.id;

DELETE FROM jf_revision_file;
DELETE FROM jf_revision;
DELETE FROM jf_registration;
DELETE FROM jf_draft;
DELETE FROM jf_idempotency;
DELETE FROM jf_audit;
DELETE FROM jf_login_attempt;
DELETE FROM jf_file;
DELETE FROM jf_entity;
DELETE FROM jf_search_outbox;
UPDATE jf_search_state SET installation_id=REPLACE(UUID(),'-',''),
  cursor_secret=CONCAT(REPLACE(UUID(),'-',''),REPLACE(UUID(),'-','')),
  committed_generation=0,indexed_generation=-1,index_name='',index_uuid='',
  rebuild_requested=TRUE,status='starting',last_error='' WHERE id=1;

DELETE r FROM sys_user_role r JOIN reset_jf_accounts a ON a.user_id=r.user_id;
DELETE p FROM sys_user_post p JOIN reset_jf_accounts a ON a.user_id=p.user_id;
DELETE s FROM sys_social s JOIN reset_jf_accounts a ON a.user_id=s.user_id;
DELETE l FROM sys_login_info l JOIN reset_jf_names n ON n.user_name=l.user_name;
DELETE l FROM sys_oper_log l JOIN reset_jf_names n ON n.user_name=l.oper_name;
DELETE m FROM sys_message m JOIN reset_jf_accounts a ON a.user_id=m.create_by;
DELETE n FROM sys_notice n JOIN reset_jf_accounts a ON a.user_id=n.create_by;
DELETE FROM sys_oss;
DELETE u FROM sys_user u JOIN reset_jf_accounts a ON a.user_id=u.user_id;
DELETE FROM jf_account;

COMMIT;
