-- RuoYi remains the authority for roles, menus and their bindings.
-- Existing jf_account.roles is retained only as a compatibility/migration mirror.
CREATE TABLE IF NOT EXISTS jf_account_review (
 id VARCHAR(64) PRIMARY KEY, user_id BIGINT NOT NULL, subject VARCHAR(20) NOT NULL,
 action VARCHAR(24) NOT NULL, actor_id BIGINT NOT NULL, actor_name VARCHAR(60) NOT NULL,
 summary VARCHAR(2000) NOT NULL, material_reference VARCHAR(1000) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 INDEX jf_account_review_user(user_id,created_at)
);
CREATE TABLE IF NOT EXISTS jf_account_name (
 user_name VARCHAR(30) PRIMARY KEY, user_id BIGINT NOT NULL UNIQUE
);
INSERT IGNORE INTO jf_account_name(user_name,user_id)
 SELECT u.user_name,a.user_id FROM jf_account a JOIN sys_user u ON u.user_id=a.user_id;
INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag,create_time,remark)
 SELECT 910070001,'全国管理员','jf_national_admin',1,'1','0','0',NOW(),'家风岗位；地区范围由家风领域校验'
 WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key='jf_national_admin');
INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag,create_time,remark)
 SELECT 910070002,'区域综合运营','jf_regional_admin',2,'1','0','0',NOW(),'家风岗位；地区范围由家风领域校验'
 WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key='jf_regional_admin');
INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag,create_time,remark)
 SELECT 910070003,'内容运营','jf_content_operator',3,'1','0','0',NOW(),'家风岗位；地区范围由家风领域校验'
 WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key='jf_content_operator');
INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag,create_time,remark)
 SELECT 910070004,'评审管理','jf_review_manager',4,'1','0','0',NOW(),'家风岗位；地区范围由家风领域校验'
 WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key='jf_review_manager');
INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag,create_time,remark)
 SELECT 910070005,'数据运营','jf_data_operator',5,'1','0','0',NOW(),'家风岗位；地区范围由家风领域校验'
 WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key='jf_data_operator');
INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag,create_time,remark)
 SELECT 910070006,'专家','jf_expert',6,'1','0','0',NOW(),'家风岗位；地区范围由家风领域校验'
 WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key='jf_expert');
INSERT INTO sys_role(role_id,role_name,role_key,role_sort,data_scope,status,del_flag,create_time,remark)
 SELECT 910070007,'投稿用户','jf_member',7,'1','0','0',NOW(),'家风岗位；地区范围由家风领域校验'
 WHERE NOT EXISTS (SELECT 1 FROM sys_role WHERE role_key='jf_member');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910070000,'家风业务权限',0,'M','0','1','',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE menu_id=910070000);
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071001,'submissions:read',910070000,'F','0','1','submissions:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='submissions:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071002,'submissions:write',910070000,'F','0','1','submissions:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='submissions:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071003,'submissions:export',910070000,'F','0','1','submissions:export',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='submissions:export');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071004,'reviews:read',910070000,'F','0','1','reviews:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='reviews:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071005,'reviews:write',910070000,'F','0','1','reviews:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='reviews:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071006,'reviews:manage',910070000,'F','0','1','reviews:manage',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='reviews:manage');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071007,'reviews:score',910070000,'F','0','1','reviews:score',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='reviews:score');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071008,'reviews:configure',910070000,'F','0','1','reviews:configure',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='reviews:configure');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071009,'experts:read',910070000,'F','0','1','experts:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='experts:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071010,'experts:write',910070000,'F','0','1','experts:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='experts:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071011,'content:read',910070000,'F','0','1','content:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='content:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071012,'content:write',910070000,'F','0','1','content:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='content:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071013,'collections:read',910070000,'F','0','1','collections:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='collections:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071014,'collections:write',910070000,'F','0','1','collections:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='collections:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071015,'collections:export',910070000,'F','0','1','collections:export',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='collections:export');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071016,'activities:read',910070000,'F','0','1','activities:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='activities:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071017,'activities:write',910070000,'F','0','1','activities:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='activities:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071018,'users:read',910070000,'F','0','1','users:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='users:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071019,'users:write',910070000,'F','0','1','users:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='users:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071020,'users:create',910070000,'F','0','1','users:create',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='users:create');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071021,'users:status',910070000,'F','0','1','users:status',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='users:status');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071022,'users:roles',910070000,'F','0','1','users:roles',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='users:roles');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071023,'users:resetPassword',910070000,'F','0','1','users:resetPassword',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='users:resetPassword');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071024,'users:review',910070000,'F','0','1','users:review',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='users:review');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071025,'education:read',910070000,'F','0','1','education:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='education:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071026,'education:write',910070000,'F','0','1','education:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='education:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071027,'welfare:read',910070000,'F','0','1','welfare:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='welfare:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071028,'welfare:write',910070000,'F','0','1','welfare:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='welfare:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071029,'ai:read',910070000,'F','0','1','ai:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='ai:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071030,'ai:write',910070000,'F','0','1','ai:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='ai:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071031,'analytics:read',910070000,'F','0','1','analytics:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='analytics:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071032,'analytics:export',910070000,'F','0','1','analytics:export',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='analytics:export');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071033,'settings:read',910070000,'F','0','1','settings:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='settings:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071034,'settings:write',910070000,'F','0','1','settings:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='settings:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071035,'notifications:read',910070000,'F','0','1','notifications:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='notifications:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071036,'notifications:write',910070000,'F','0','1','notifications:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='notifications:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071037,'audit:read',910070000,'F','0','1','audit:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='audit:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071038,'jobs:read',910070000,'F','0','1','jobs:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='jobs:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071039,'jobs:export',910070000,'F','0','1','jobs:export',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='jobs:export');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071040,'certificates:read',910070000,'F','0','1','certificates:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='certificates:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071041,'certificates:write',910070000,'F','0','1','certificates:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='certificates:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071042,'resources:read',910070000,'F','0','1','resources:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='resources:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071043,'resources:write',910070000,'F','0','1','resources:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='resources:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071044,'regions:read',910070000,'F','0','1','regions:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='regions:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071045,'regions:write',910070000,'F','0','1','regions:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='regions:write');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071046,'consultations:read',910070000,'F','0','1','consultations:read',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='consultations:read');
INSERT INTO sys_menu(menu_id,menu_name,parent_id,menu_type,status,visible,perms,create_time)
 SELECT 910071047,'consultations:write',910070000,'F','0','1','consultations:write',NOW()
 WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE parent_id=910070000 AND perms='consultations:write');
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
 SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key='jf_national_admin' AND m.parent_id=910070000 AND m.perms IN ('submissions:read','submissions:write','submissions:export','reviews:read','reviews:write','reviews:manage','reviews:score','reviews:configure','experts:read','experts:write','content:read','content:write','collections:read','collections:write','collections:export','activities:read','activities:write','users:read','users:write','users:create','users:status','users:roles','users:resetPassword','users:review','education:read','education:write','welfare:read','welfare:write','ai:read','ai:write','analytics:read','analytics:export','settings:read','settings:write','notifications:read','notifications:write','audit:read','jobs:read','jobs:export','certificates:read','certificates:write','resources:read','resources:write','regions:read','regions:write','consultations:read','consultations:write');
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
 SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key='jf_regional_admin' AND m.parent_id=910070000 AND m.perms IN ('submissions:read','submissions:write','submissions:export','reviews:read','reviews:write','reviews:manage','experts:read','experts:write','content:read','content:write','collections:read','collections:write','collections:export','activities:read','activities:write','users:read','users:write','users:status','users:review','education:read','education:write','welfare:read','welfare:write','ai:read','ai:write','analytics:read','analytics:export','settings:read','notifications:read','notifications:write','audit:read','jobs:read','jobs:export','certificates:read','certificates:write','resources:read','resources:write','regions:read','consultations:read','consultations:write');
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
 SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key='jf_content_operator' AND m.parent_id=910070000 AND m.perms IN ('content:read','content:write','collections:read','collections:write','collections:export','activities:read','activities:write','education:read','education:write','welfare:read','welfare:write','notifications:read','notifications:write','resources:read','resources:write','consultations:read','consultations:write','jobs:read','jobs:export');
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
 SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key='jf_review_manager' AND m.parent_id=910070000 AND m.perms IN ('submissions:read','submissions:write','submissions:export','reviews:read','reviews:write','reviews:manage','experts:read','experts:write','certificates:read','certificates:write','jobs:read','jobs:export');
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
 SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key='jf_data_operator' AND m.parent_id=910070000 AND m.perms IN ('analytics:read','analytics:export','jobs:read','jobs:export','submissions:read','submissions:export','collections:read','collections:export','activities:read','education:read','welfare:read','content:read','audit:read');
INSERT IGNORE INTO sys_role_menu(role_id,menu_id)
 SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m
 WHERE r.role_key='jf_expert' AND m.parent_id=910070000 AND m.perms IN ('reviews:read','reviews:write','reviews:score');
INSERT IGNORE INTO sys_user_role(user_id,role_id)
 SELECT a.user_id,r.role_id FROM jf_account a
 JOIN (SELECT 0 idx UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) n ON n.idx<JSON_LENGTH(a.roles)
 JOIN sys_role r ON r.role_key=CONCAT('jf_',JSON_UNQUOTE(JSON_EXTRACT(a.roles,CONCAT('$[',n.idx,']'))))
 WHERE JSON_EXTRACT(a.profile,'$.rbacMigrated') IS NULL;
UPDATE jf_account SET profile=JSON_SET(profile,'$.rbacMigrated',true)
 WHERE JSON_EXTRACT(profile,'$.rbacMigrated') IS NULL;

