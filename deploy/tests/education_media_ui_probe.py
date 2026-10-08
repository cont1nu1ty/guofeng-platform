#!/usr/bin/env python3
"""Browser checks using the isolated stack and explicitly synthetic education/media fixtures."""
import asyncio, io, json, os
from pathlib import Path
from urllib.parse import urlsplit
import struct, zlib
from playwright.async_api import async_playwright
from business_probe import Client, BASE
OUT=Path(os.environ.get('JIAFENG_PROBE_OUTPUT','deploy/.local/non-ai-20261007'))
async def main():
    assert os.environ.get('JIAFENG_ISOLATED_TEST')=='1'
    fixtures=json.loads((OUT/'education-media-acceptance.json').read_text())
    admin=Client('devadmin','admin');member=Client('member_zj')
    course=member.call('GET','/education/courses/'+fixtures['courseId'])[1]['course']
    colors=[bytes.fromhex(value) for value in ['994733','467267','a98b52','5a6480']]
    row=b'\x00'+b''.join(colors[(x//128)%4] for x in range(1024))
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    panorama=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1024,512,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(row*512))+chunk(b'IEND',b'')
    errors=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True,args=['--enable-unsafe-swiftshader'])
        async def context(client,admin_mode=False):
            ctx=await browser.new_context(viewport={'width':1440,'height':1000})
            await ctx.add_init_script("sessionStorage.setItem('Jiafeng-Admin-Token', "+json.dumps(client.token)+");" if admin_mode else "localStorage.setItem('jiafeng:http:token', "+json.dumps(client.token)+");")
            async def route_api(route):
                suffix=route.request.url.split('/api/v1',1)[1]
                headers={k:v for k,v in route.request.headers.items() if k not in ['host','origin','referer']}
                response=await route.fetch(url=BASE+suffix,headers=headers)
                if not admin_mode and suffix=='/workspace':
                    data=await response.json()
                    data['hallPeople'].append({'id':'ui_panorama_fixture','title':'合成全景交互验收','language':'zh','region':'all','status':'已发布','sortOrder':0,'era':'合成测试','theme':'测试','book':'合成资料','quote':'此图片是隔离浏览器测试图案，不是真实展馆。','introduction':'以合成图案验证视角控制，不冒充实景。','notes':'合成图片\n交互验收','panoramaUrl':'https://panorama-fixture.invalid/scene.png','sourceTitle':'合成测试图案','sourceUrl':''})
                    await route.fulfill(status=response.status,content_type='application/json',body=json.dumps(data,ensure_ascii=False))
                else:await route.fulfill(response=response)
            await ctx.route('**/api/v1/**',route_api)
            await ctx.route('https://panorama-fixture.invalid/scene.png',lambda route:route.fulfill(status=200,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'},body=panorama))
            return ctx
        ac=await context(admin,True);page=await ac.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
        await page.goto('http://127.0.0.1:15174/admin/#/education',wait_until='networkidle')
        await page.get_by_text(course['title'],exact=True).wait_for(timeout=20000)
        card=page.locator('.education-course').filter(has_text=course['title'])
        await card.get_by_role('button',name='编辑草稿',exact=True).click()
        await page.get_by_role('dialog').wait_for()
        assert await page.get_by_role('dialog').locator('input').filter(has_text='').count()>3
        assert await page.get_by_role('dialog').get_by_text('单选题库与组卷',exact=False).count()>0
        await page.screenshot(path=str(OUT/'education-editor-desktop.png'),full_page=True)
        await page.set_viewport_size({'width':390,'height':844});await page.screenshot(path=str(OUT/'education-editor-mobile.png'),full_page=True)
        await ac.close()
        ctx=await context(member);page=await ctx.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
        await page.goto('http://127.0.0.1:15173/#/pkg-content/pages/index?screen=classroom&id='+fixtures['courseId'],wait_until='networkidle')
        await page.get_by_text(course['title'],exact=True).wait_for(timeout=30000)
        for _ in range(2):
            button=page.get_by_text('我已阅读本节',exact=True)
            if await button.count():await button.click();await page.wait_for_timeout(700)
        await page.get_by_text('履行承诺',exact=True).click()
        await page.get_by_text('提交测验',exact=True).click()
        await page.get_by_text('本次成绩 100%',exact=False).wait_for(timeout=10000)
        await page.screenshot(path=str(OUT/'education-learner-desktop.png'),full_page=True)
        await page.set_viewport_size({'width':390,'height':844})
        await page.screenshot(path=str(OUT/'education-learner-mobile.png'),full_page=True)
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        await page.goto('http://127.0.0.1:15173/#/pkg-content/pages/index?screen=media&id='+fixtures['mediaId'],wait_until='networkidle')
        await page.reload(wait_until='networkidle')
        await page.screenshot(path=str(OUT/'media-page-diagnostic.png'),full_page=True)
        (OUT/'media-page-diagnostic.txt').write_text(await page.locator('body').inner_text())
        await page.get_by_text('人工字幕与朗读',exact=True).wait_for(timeout=15000)
        await page.get_by_text('阅读完整字幕',exact=True).click()
        assert await page.get_by_text('第一句人工字幕',exact=True).count()>0
        video=page.locator('video').first
        await video.evaluate('(v) => { v.muted = true; return v.play(); }')
        await page.wait_for_timeout(600)
        await page.screenshot(path=str(OUT/'media-caption-mobile.png'),full_page=True)
        assert await video.evaluate('(v) => v.currentTime')>0
        await page.goto('http://127.0.0.1:15173/#/pkg-content/pages/index?screen=hall&id=ui_panorama_fixture',wait_until='networkidle')
        await page.reload(wait_until='networkidle')
        await page.get_by_text('重置视角',exact=True).wait_for(timeout=15000)
        await page.get_by_text('向右',exact=True).click();await page.get_by_text('放大',exact=True).click()
        await page.screenshot(path=str(OUT/'panorama-mobile.png'),full_page=True)
        assert await page.locator('.panorama-canvas canvas').count()==1
        await page.get_by_text('重置视角',exact=True).click()
        await page.set_viewport_size({'width':1440,'height':1000});await page.screenshot(path=str(OUT/'panorama-desktop.png'),full_page=True)
        await ctx.close();await browser.close()
    assert not errors,errors
    print('PASS desktop/mobile course editor, versioned reading and server quiz, published captions/video playback, synthetic WebGL panorama controls; no browser page errors')
if __name__=='__main__':asyncio.run(main())
