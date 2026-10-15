#!/usr/bin/env python3
"""Check that adding an unrelated content post cannot widen an expert's task scope."""
import json
import datetime as dt
import uuid
from security_auth_probe import Client, ROOT, sql


def main():
    expert = Client('expert_zj', 'admin')
    other = Client('member_bj')
    uid = int(expert.user['id'])
    source = sql(f"SELECT id FROM jf_entity WHERE kind='task' AND owner_id={uid} ORDER BY created_at DESC LIMIT 1")
    assert source, 'run security_auth_probe first to create a synthetic blind-task source'
    fixture = 'security_other_task_' + uuid.uuid4().hex[:12]
    role = int(sql("SELECT role_id FROM sys_role WHERE role_key='jf_content_operator' AND status='0'"))
    review_role = int(sql("SELECT role_id FROM sys_role WHERE role_key='jf_review_manager' AND status='0'"))
    assert sql(f'SELECT COUNT(*) FROM sys_user_role WHERE user_id={uid} AND role_id={role}') == '0'
    assert sql(f'SELECT COUNT(*) FROM sys_user_role WHERE user_id={uid} AND role_id={review_role}') == '0'
    saved_manage = sql(f"SELECT rm.menu_id FROM sys_role_menu rm JOIN sys_menu m ON m.menu_id=rm.menu_id "
        f"WHERE rm.role_id={review_role} AND m.perms='reviews:manage'")
    manage_menus = [int(value) for value in saved_manage.splitlines()]
    start, due = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1), dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)
    sql(f"INSERT INTO jf_entity(id,kind,owner_id,region_id,status,payload) SELECT '{fixture}','task',{int(other.user['id'])},"
        f"'zhejiang','待评分',JSON_SET(payload,'$.content','SECURITY_OTHER_BLIND_MATERIAL','$.expertName','OTHER_SYNTHETIC_EXPERT',"
        f"'$.startsAt','{start.isoformat()}','$.dueAt','{due.isoformat()}','$.windowVersion',1) FROM jf_entity WHERE id='{source}'")
    sql(f"INSERT INTO jf_review_window(task_id,submission_id,owner_id,manager_id,region_id,status,starts_at_ms,due_at_ms,window_version) "
        f"SELECT '{fixture}',JSON_UNQUOTE(JSON_EXTRACT(payload,'$.submissionId')),{int(other.user['id'])},"
        f"JSON_EXTRACT(payload,'$.managerId'),'zhejiang','待评分',{int(start.timestamp()*1000)},{int(due.timestamp()*1000)},1 "
        f"FROM jf_entity WHERE id='{fixture}'")
    result = {'fixture': fixture, 'notice': 'synthetic other-owner read fixture; no external model or real data'}
    try:
        status, _, _ = expert.call('GET', '/admin/records/tasks/' + fixture, expected=None)
        result['singleExpertDetailStatus'] = status
        assert status == 404, 'single expert must not read the other-owner fixture'
        sql(f'INSERT INTO sys_user_role(user_id,role_id) VALUES({uid},{role})')
        actor = expert.call('GET', '/auth/me')[1]
        assert set(actor['roles']) == {'expert', 'content_operator'}
        assert 'reviews:read' in actor['permissions'] and 'reviews:manage' not in actor['permissions']
        status, body, _ = expert.call('GET', '/admin/records/tasks/' + fixture, expected=None)
        result['combinedDetailStatus'] = status
        result['combinedDetailExposesBlindContent'] = body.get('content') == 'SECURITY_OTHER_BLIND_MATERIAL'
        items = expert.call('GET', '/admin/records/tasks?pageSize=100')[1]['items']
        result['combinedListContainsOtherTask'] = any(item['id'] == fixture for item in items)
        result['combinedWorkspaceContainsOtherTask'] = any(item['id'] == fixture for item in expert.workspace(True)['tasks'])
        alerts = expert.call('GET', '/admin/review-alerts?scope=all&pageSize=100')[1]['items']
        result['combinedAlertsContainOtherTask'] = any(item['id'] == fixture for item in alerts)
        sql(f"DELETE rm FROM sys_role_menu rm JOIN sys_menu m ON m.menu_id=rm.menu_id "
            f"WHERE rm.role_id={review_role} AND m.perms='reviews:manage'")
        sql(f'INSERT INTO sys_user_role(user_id,role_id) VALUES({uid},{review_role})')
        actor = expert.call('GET', '/auth/me')[1]
        assert 'review_manager' in actor['roles'] and 'reviews:manage' not in actor['permissions']
        status, body, _ = expert.call('GET', '/admin/records/tasks/' + fixture, expected=None)
        result['readOnlyReviewManagerDetailStatus'] = status
        result['readOnlyReviewManagerReadsAuthorizedRegion'] = body.get('content') == 'SECURITY_OTHER_BLIND_MATERIAL'
        alerts = expert.call('GET', '/admin/review-alerts?scope=all&pageSize=100')[1]['items']
        result['readOnlyReviewManagerAlertsContainTask'] = any(item['id'] == fixture for item in alerts)
        narrower = expert.call('GET', '/admin/records/tasks?region=beijing&pageSize=100')[1]['items']
        result['requestedOtherRegionContainsTask'] = any(item['id'] == fixture for item in narrower)
    finally:
        sql(f'DELETE FROM sys_user_role WHERE user_id={uid} AND role_id={role}')
        sql(f'DELETE FROM sys_user_role WHERE user_id={uid} AND role_id={review_role}')
        if manage_menus:
            sql('INSERT IGNORE INTO sys_role_menu(role_id,menu_id) VALUES ' + ','.join(f'({review_role},{menu})' for menu in manage_menus))
        sql(f"DELETE FROM jf_review_delivery WHERE task_id='{fixture}'")
        sql(f"DELETE FROM jf_review_window WHERE task_id='{fixture}'")
        sql(f"DELETE FROM jf_entity WHERE id='{fixture}'")
    output = ROOT / 'deploy/.local/security-2026-10-15/multi-role-results.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    assert result['combinedDetailStatus'] == 404, result
    assert not result['combinedListContainsOtherTask'], result
    assert not result['combinedWorkspaceContainsOtherTask'], result
    assert not result['combinedAlertsContainOtherTask'], result
    assert result['readOnlyReviewManagerDetailStatus'] == 200 and result['readOnlyReviewManagerReadsAuthorizedRegion'], result
    assert result['readOnlyReviewManagerAlertsContainTask'], result
    assert not result['requestedOtherRegionContainsTask'], result
    print('PASS unrelated content role preserves expert task ownership in detail/list/workspace', flush=True)
    print('PASS review management read grant survives write revocation and request region only narrows scope', flush=True)


if __name__ == '__main__':
    main()
