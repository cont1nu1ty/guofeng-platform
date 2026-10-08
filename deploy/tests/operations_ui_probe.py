#!/usr/bin/env python3
"""Real admin pages and controls in the isolated release verification environment."""
import json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
os.environ.setdefault("JIAFENG_TEST_URL","http://127.0.0.1:19084")
from business_probe import ENV,ROOT,Client
from jobs_schedule_probe import command
assert ENV['COMPOSE_PROJECT_NAME'].startswith('jiafeng-demo-non-ai-')
from playwright.sync_api import sync_playwright,expect
OUT=ROOT/'deploy/.local/non-ai-20261007/browser-operations';OUT.mkdir(exist_ok=True)
fixture=json.loads((OUT.parent/'pagination-engagement.json').read_text());activity_id=fixture['activityId']
admin=Client('devadmin','admin');activity=admin.call('GET','/admin/records/activities/'+activity_id)[1]
if activity['status']=='报名中':command(admin,'setActivityStatus',activity_id,{'status':'进行中'},'activities')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);ctx=b.new_context(viewport={'width':1440,'height':950},accept_downloads=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:19084/admin/');page.get_by_role('heading',name='欢迎回到工作空间').wait_for();page.get_by_placeholder('运营账号').fill('devadmin');page.get_by_placeholder('账号密码').fill(ENV['JIAFENG_DEV_PASSWORD']);page.get_by_role('button',name='登录工作空间').click();page.get_by_role('heading',name='运营工作台',exact=True).wait_for();page.get_by_text('我的工作入口',exact=True).wait_for()
 for width in [1440,390]:
  page.set_viewport_size({'width':width,'height':950})
  for route,title in [('overview','运营工作台'),('analytics','数据智库'),('jobs','导出与报告'),('collections','典籍编纂'),('activities','活动与传习')]:
   page.goto('http://127.0.0.1:19084/admin/#/'+route);page.get_by_role('heading',name=title,exact=True).wait_for(timeout=15000)
   if route=='collections':
    page.get_by_role('button',name='PDF / Word 导出',exact=True).click()
    dialog=page.get_by_role('dialog',name='典籍文件导出');expect(dialog).to_be_visible();expect(dialog.get_by_role('button',name='创建导出任务')).to_be_disabled();dialog.get_by_role('button',name='取消',exact=True).click();expect(dialog).not_to_be_visible()
   if route=='activities':
    page.get_by_role('textbox',name='搜索全部记录',exact=True).fill(activity_id)
    with page.expect_response(lambda response:'/admin/records/activities?' in response.url and activity_id in response.url):page.get_by_role('button',name='查询',exact=True).click()
    with page.expect_response(lambda response:'/registrations?' in response.url and response.request.method=='GET') as response:
     page.get_by_role('button',name='报名与签到').first.click()
    assert response.value.status==200
    panel=page.get_by_role('dialog',name='报名与签到');expect(panel).to_be_visible()
    panel.get_by_role('button',name='撤销签到',exact=True).click();expect(panel.locator('.registration-stats strong').nth(1)).to_have_text('0')
    panel.get_by_role('button',name='签到',exact=True).click();expect(panel.locator('.registration-stats strong').nth(1)).to_have_text('1')
    with page.expect_response(lambda response:'/registrations?' in response.url and 'q=notfound' in response.url) as response:
     panel.get_by_placeholder('搜索姓名或机构').fill('notfound')
    assert response.value.status==200
    expect(panel.get_by_text('暂无匹配的报名记录',exact=True)).to_be_visible();page.keyboard.press('Escape');expect(panel).not_to_be_visible()
   page.screenshot(path=str(OUT/f'{route}-{width}.png'),full_page=True)
   overflow=page.evaluate('document.documentElement.scrollWidth>window.innerWidth+1');print(route,width,'overflow',overflow)
   assert not overflow,(route,width)
 assert not errors,errors
 print('ERRORS',errors)
 (OUT/'result.json').write_text(json.dumps({'pageErrors':errors,'viewports':[1440,390]},ensure_ascii=False,indent=2))
 b.close()
