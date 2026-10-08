#!/usr/bin/env python3
"""Browse installed scenarios without changing their learning/review/business states."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scenarios.common import base, catalog
from playwright.sync_api import sync_playwright

BASE = base.BASE.removesuffix('/api/v1')
OUT = Path(__file__).resolve().parents[1] / '.local/non-ai-showcase-20261008/browser'
OUT.mkdir(parents=True, exist_ok=True)
receipt = json.loads(base.sql("SELECT payload FROM jf_entity WHERE id='demoNonAiState' AND kind='setting'"))
records = receipt['records']
assert receipt['phase'] == 'complete'
clients = {}
errors, checked = [], []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--enable-unsafe-swiftshader'])
    routes = [
        ('home', '', False, '/#/', '家风'),
        ('review', 'member_zj', False, '/#/pages/explore/index?screen=review&id=' + records['review:revision']['id'], '本版本评审进度'),
        ('offline', 'member_zj', False, '/#/pages/explore/index?screen=review&id=' + records['review:offline-pending']['id'], '本版本评审进度'),
        ('course', 'member_js', False, '/#/pkg-content/pages/index?screen=classroom&id=' + records['education:daily']['id'], '把约定写进日常'),
        ('media', 'member_zj', False, '/#/pkg-content/pages/index?screen=media&id=' + records['education:media:captions-live']['id'], '人工字幕与朗读'),
        ('panorama', 'member_zj', False, '/#/pkg-content/pages/index?screen=hall&id=' + records['education:panorama']['id'], '展馆全景'),
        ('consultation', 'member_zj', False, '/#/pkg-content/pages/index?screen=shop&view=records', '我的公益申领与定制咨询'),
        ('accounts', 'devadmin', True, '/admin/#/users', '用户与权限'),
        ('education-admin', 'devadmin', True, '/admin/#/education', '把约定写进日常'),
        ('certificates', 'devadmin', True, '/admin/#/certificates', '证书'),
        ('resources', 'devadmin', True, '/admin/#/resources', '家风资料使用指南 · 共读版'),
        ('jobs', 'devadmin', True, '/admin/#/jobs', '导出与报告'),
    ]
    for name, username, admin, path, ready in routes:
        context = browser.new_context(viewport={'width': 1440, 'height': 950})
        if username:
            key = (username, admin)
            if key not in clients: clients[key] = catalog.Client(username, 'admin' if admin else 'member')
            storage = 'sessionStorage' if admin else 'localStorage'
            token_key = 'Jiafeng-Admin-Token' if admin else 'jiafeng:http:token'
            context.add_init_script(f'{storage}.setItem({json.dumps(token_key)}, {json.dumps(clients[key].token)});')
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + path)
        try:
            page.get_by_text(ready, exact=False).first.wait_for(timeout=30000)
            if name == 'review':
                page.get_by_text('查看评分标准', exact=True).first.click()
                page.get_by_text('家书共读标准', exact=False).first.wait_for()
            if name == 'panorama':
                # Use the actual external licensed image; no mocked responses.
                page.get_by_text('重置视角', exact=True).wait_for(timeout=60000)
                page.get_by_text('向左', exact=True).click()
                page.get_by_text('放大', exact=True).click()
                page.get_by_text('重置视角', exact=True).click()
            for width in (1440, 390):
                page.set_viewport_size({'width': width, 'height': 950})
                page.screenshot(path=str(OUT / f'{name}-{width}.png'), full_page=True)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (name, width)
                checked.append({'page': name, 'width': width})
            (OUT / f'{name}.txt').write_text(page.locator('body').inner_text())
        except Exception:
            page.screenshot(path=str(OUT / f'{name}-failed.png'), full_page=True)
            (OUT / f'{name}-failed.txt').write_text(page.locator('body').inner_text())
            raise
        finally:
            context.close()
        print('Checked', name, flush=True)
    browser.close()
assert not errors, errors
(OUT / 'result.json').write_text(json.dumps({'checks': checked, 'pageErrors': errors, 'url': BASE}, indent=2))
print('PASS', len(checked), 'desktop/mobile page checks')
