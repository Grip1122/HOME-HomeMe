"""Real Chromium check of the restaurant asset, robot controls and scene switching."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'restaurant_browser_qa'
OUT.mkdir(parents=True,exist_ok=True)
BROWSER='/home/xch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'


def main():
    errors=[];console=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=BROWSER,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
        page=browser.new_page(viewport={'width':1500,'height':1100},device_scale_factor=1)
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('console',lambda message:console.append(message.type+': '+message.text))
        page.goto('http://127.0.0.1:8765',wait_until='domcontentloaded')
        page.wait_for_function("!document.querySelector('#start').disabled",timeout=120000)
        page.wait_for_function("document.querySelector('#restaurant-view').dataset.loaded==='yes'",timeout=120000)
        page.wait_for_timeout(3000)
        page.screenshot(path=str(OUT/'restaurant-ready.png'),full_page=True)
        assert not page.locator('#restaurant-view').is_hidden()
        assert '餐厅' in page.locator('#scene-select').inner_text()
        page.locator('#start').click()
        page.wait_for_function("parseInt(document.querySelector('#ring-count').textContent)>=3",timeout=90000)
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#start').textContent.includes('继续')",timeout=15000)
        s=page.request.get('http://127.0.0.1:8765/api/state').json()
        assert s['scene']=='restaurant' and s['scans']>=3 and s['cloud_points']>1000
        page.screenshot(path=str(OUT/'restaurant-scanning.png'),full_page=True)
        page.locator('#restaurant-home').click()
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT/'restaurant-overview.png'),full_page=True)
        page.locator('#tab-scene').click()
        page.wait_for_function("document.querySelector('#scene').naturalWidth>0",timeout=30000)
        page.screenshot(path=str(OUT/'restaurant-proxy.png'),full_page=True)
        page.locator('#tab-cloud').click()
        page.wait_for_timeout(2300)
        page.screenshot(path=str(OUT/'restaurant-cloud.png'),full_page=True)
        page.locator('#scene-select').select_option('demo')
        page.wait_for_function("fetch('/api/state').then(r=>r.json()).then(s=>s.scene==='demo'&&s.status==='ready')",timeout=60000)
        page.locator('#tab-restaurant').wait_for(state='hidden',timeout=10000)
        page.locator('#scene-select').select_option('restaurant')
        page.wait_for_function("fetch('/api/state').then(r=>r.json()).then(s=>s.scene==='restaurant'&&s.status==='ready')",timeout=60000)
        page.wait_for_timeout(1500)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(OUT/'restaurant-mobile.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile horizontal overflow'
        assert not errors,errors
        (OUT/'result.json').write_text(json.dumps({'passed':True,'page_errors':errors,'console':console,'observed_state':{k:s[k] for k in ('scene','scans','coverage','cloud_points','candidate_count')},'checks':['Gaussian compressed PLY loads','live robot','real proxy-depth scans','proxy view','cloud view','demo switch','restaurant switch','mobile layout']},ensure_ascii=False,indent=2)+'\n')
        browser.close()
        print('Restaurant browser checks passed: '+str(OUT))


if __name__=='__main__':main()
