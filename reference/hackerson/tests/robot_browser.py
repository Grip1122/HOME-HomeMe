"""Check the crawler's real GLB, mast articulation, differential treads and live view."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'robot_qa'
BROWSER='/home/xch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'


def main():
    OUT.mkdir(exist_ok=True)
    errors=[];poses=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=BROWSER,args=['--no-sandbox','--use-gl=angle','--use-angle=vulkan','--ignore-gpu-blocklist'])
        page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://127.0.0.1:8765/robot')
        page.wait_for_function("document.querySelector('#robot-preview').dataset.loaded==='yes'",timeout=30000)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(OUT/'robot-studio.png'),full_page=True)
        for name,height,tilt in [('collapsed',.55,0),('extended',2.3,30),('tilted',1.15,-37)]:
            page.evaluate('p=>window.robotPreview.setPose(p[0],p[1])',[height,tilt])
            page.wait_for_timeout(1000)
            diag=page.evaluate('window.robotPreview.robot.diagnostics()')
            assert abs(diag['head'][1]-height)<2e-6,diag
            assert diag['trackLinks']==[42,42],diag
            poses.append(diag)
            page.screenshot(path=str(OUT/(name+'.png')),full_page=True)
        turning=page.evaluate("""()=>{
          const robot=window.robotPreview.robot;
          robot.update({xy:[0,0],height:1.15,tilt_deg:0,yaw:0,epoch:'turn-test'});
          robot.update({xy:[0,0],height:1.15,tilt_deg:0,yaw:.2,epoch:'turn-test'});
          return robot.diagnostics();
        }""")
        assert turning['leftTravel']<0<turning['rightTravel'],turning
        assert abs(turning['leftTravel']+turning['rightTravel'])<1e-8
        page.locator('#animate-mast').click()
        page.wait_for_timeout(500)
        assert page.locator('#animate-mast').inner_text().startswith('暂停')
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
        page.set_viewport_size({'width':1500,'height':1100})
        page.request.post('http://127.0.0.1:8765/api/command',data={'action':'reset','strategy':'adaptive'})
        page.goto('http://127.0.0.1:8765/')
        page.wait_for_function("window.restaurantRenderer?.diagnostics().robot?.model==='RoomScan RS-01 Crawler'",timeout=120000)
        page.wait_for_function("document.querySelector('#raw-ring').dataset.source==='original-gaussian'",timeout=120000)
        page.locator('#robot-closeup').click()
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT/'restaurant-closeup.png'),full_page=True)
        page.locator('#start').click()
        page.wait_for_function('Math.abs(window.restaurantRenderer.diagnostics().robot.leftTravel)>.1',timeout=90000)
        moving=page.evaluate('window.restaurantRenderer.diagnostics()')
        assert moving['robot']['trackLinks']==[42,42]
        assert abs(moving['robot']['head'][1]-moving['displayPose']['height'])<2e-6
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#start').textContent.includes('继续')",timeout=15000)
        page.locator('#tab-scene').click()
        page.wait_for_function("document.querySelector('#scene').naturalWidth>0",timeout=15000)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT/'proxy-exterior.png'),full_page=True)
        assert not errors,errors
        result={'passed':True,'page_errors':errors,'poses':poses,'turning':turning,'live_robot':moving['robot'],'note':'Server-side Chromium with NVIDIA Vulkan; no Windows frame-rate claim.'}
        (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        page.request.post('http://127.0.0.1:8765/api/command',data={'action':'reset','strategy':'adaptive'})
        browser.close()
        print('Crawler exterior, 84 tread links, differential motion, mast poses and live scene passed.')


if __name__=='__main__':main()
