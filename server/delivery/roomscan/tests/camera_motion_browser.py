"""Validate real Gaussian camera pixels, high-rate poses and interpolated rendering."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'camera_motion_qa'
OUT.mkdir(parents=True,exist_ok=True)
BROWSER='/home/xch/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell'


def main():
    errors=[];requests=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=BROWSER,headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=vulkan','--ignore-gpu-blocklist'])
        page=browser.new_page(viewport={'width':1500,'height':1100},device_scale_factor=1)
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.on('request',lambda request:requests.append(request.url))
        page.request.post('http://127.0.0.1:8765/api/command',data={'action':'reset','strategy':'adaptive'})
        page.goto('http://127.0.0.1:8765',wait_until='domcontentloaded')
        page.wait_for_function("document.querySelector('#raw-ring').dataset.source==='original-gaussian'",timeout=180000)
        pixel_stats=page.evaluate("""() => {
          const c=document.querySelector('#raw-ring'),ctx=c.getContext('2d');
          return Array.from({length:4},(_,i)=>{const data=ctx.getImageData(i*320,0,320,240).data;let sum=0,sq=0,n=0;for(let j=0;j<data.length;j+=16){const v=(data[j]+data[j+1]+data[j+2])/3;sum+=v;sq+=v*v;n++;}return {mean:sum/n,std:Math.sqrt(sq/n-(sum/n)**2)};});
        }""")
        assert all(x['std']>10 for x in pixel_stats),pixel_stats
        page.locator('.sensor-strip').screenshot(path=str(OUT/'original-camera-preview.png'))
        page.locator('#start').click()
        page.wait_for_function("parseInt(document.querySelector('#raw-ring').dataset.scan)>=1",timeout=120000)
        page.wait_for_function("window.restaurantRenderer.diagnostics().displayPose?.phase==='moving'",timeout=60000)
        samples=page.evaluate("""() => new Promise(resolve=>{
          const data=[];let started=performance.now();function frame(){const d=window.restaurantRenderer.diagnostics();data.push({t:performance.now(),sequence:d.displayPose?.sequence,x:d.displayPose?.xy[0],y:d.displayPose?.xy[1],blend:d.displayPose?.interpolation,poseCount:d.poseCount});if(performance.now()-started<6000)requestAnimationFrame(frame);else resolve(data);}requestAnimationFrame(frame);
        })""")
        assert len(samples)>3
        assert any(x.get('blend') is not None and 0<x['blend']<1 for x in samples),samples
        page.locator('#start').click()
        page.wait_for_function("document.querySelector('#start').textContent.includes('继续')",timeout=15000)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(OUT/'smooth-robot-and-original-camera.png'),full_page=True)
        assert not any('/ring.jpg' in url for url in requests),'Restaurant fetched proxy camera RGB'
        assert any('restaurant.compressed.ply' in url for url in requests),'Full original scene was not loaded'
        assert not errors,errors
        result={'passed':True,'page_errors':errors,'camera_source':'original-gaussian','pixel_stats':pixel_stats,'motion_samples':samples,'note':'Browser is server-side Chromium using NVIDIA Vulkan; not a Windows FPS measurement.'}
        (OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        page.request.post('http://127.0.0.1:8765/api/command',data={'action':'reset','strategy':'adaptive'})
        browser.close()
        print('Original camera and smooth pose browser checks passed: '+str(OUT))


if __name__=='__main__':main()
