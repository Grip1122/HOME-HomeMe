"""Real-browser check against an already running local server.

QA only: PYTHONPATH=/tmp/hackerson-browser-qa python3 tests/browser_smoke.py
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'browser_qa'
OUT.mkdir(parents=True,exist_ok=True)
BROWSER='/home/xch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'


def main():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=BROWSER,headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1500,'height':1100},device_scale_factor=1)
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.request.post('http://127.0.0.1:8765/api/command',data={'action':'reset','strategy':'adaptive'})
        page.goto('http://127.0.0.1:8765',wait_until='domcontentloaded')
        page.wait_for_function("!document.querySelector('#start').disabled",timeout=60000)
        page.wait_for_function("document.querySelector('#ring-count').textContent==='00'",timeout=15000)
        page.wait_for_function("document.querySelector('#scene').naturalWidth > 0",timeout=30000)
        page.screenshot(path=str(OUT/'ready-desktop.png'),full_page=True)
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#start').textContent.includes('暂停')",timeout=10000)
        page.wait_for_function("parseInt(document.querySelector('#ring-count').textContent)>=3",timeout=60000)
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#start').textContent.includes('继续')",timeout=10000)
        paused=page.request.get('http://127.0.0.1:8765/api/state').json()
        assert paused['status']=='paused' and paused['scans']>=3 and paused['cloud_points']>1000
        page.screenshot(path=str(OUT/'scanning-desktop.png'),full_page=True)
        page.locator('#tab-cloud').click()
        page.wait_for_timeout(2400)
        page.locator('#cloud-view').drag_to(page.locator('#cloud-view'),source_position={'x':200,'y':200},target_position={'x':330,'y':220})
        page.screenshot(path=str(OUT/'cloud-desktop.png'),full_page=True)
        page.locator('#export').click()
        page.wait_for_function("!document.querySelector('#downloads').hidden",timeout=10000)
        assert page.request.get('http://127.0.0.1:8765/download/cloud.ply').text().startswith('ply\n')
        assert page.request.post('http://127.0.0.1:8765/api/command',data={'action':'bogus'}).status==400
        assert page.request.post('http://127.0.0.1:8765/api/command',data={'action':'start'},headers={'Origin':'https://example.invalid'}).status==403
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow on mobile'
        page.locator('#reset').click()
        page.wait_for_function("document.querySelector('#ring-count').textContent==='00'",timeout=10000)
        page.locator('#strategy').select_option('fixed')
        page.wait_for_function("document.querySelector('#strategy').value==='fixed'",timeout=10000)
        # Verify backend strategy too, avoiding a select-state-only false positive.
        page.wait_for_function("fetch('/api/state').then(r=>r.json()).then(s=>s.strategy==='fixed'&&s.scans===0)",timeout=10000)
        page.locator('#strategy').select_option('adaptive')
        page.wait_for_function("fetch('/api/state').then(r=>r.json()).then(s=>s.strategy==='adaptive'&&s.status==='ready')",timeout=10000)
        assert not errors, errors
        (OUT/'result.json').write_text(json.dumps({'passed':True,'page_errors':errors,'paused_state':{k:paused[k] for k in ('scans','coverage','cloud_points','status')},'checks':['real frames','start','pause','point cloud rotation','export/download','reset','strategy switch','invalid command','cross-origin rejection','mobile overflow']},indent=2)+'\n')
        browser.close()
        print('Browser checks passed. Screenshots: '+str(OUT))


if __name__=='__main__':main()
