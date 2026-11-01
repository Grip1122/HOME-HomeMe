// 产品页实操验收：真实 Chrome，经 HUD 输入框提交指令，截图 + 断言 + /log 查询。
// 用法：node web/scripts/product-e2e.mjs [baseUrl] [outDir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import WebSocket from 'ws';

const BASE = process.argv[2] || 'http://127.0.0.1:8000';
const OUT = process.argv[3] || 'docs/product-evidence';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-e2e-'));
const port = 9333;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const logs = [];
function send(method, params = {}) {
  return new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
}
async function waitFor(expr, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evalJs(expr)) return true;
    await sleep(250);
  }
  throw new Error('超时：' + expr);
}
async function ask(query) {
  await evalJs(`(() => { const i = document.querySelector('.ht-chat-input'); i.value = ${JSON.stringify(query)};
    document.querySelector('.ht-send-btn').click(); return true; })()`);
}
const lastLog = () => fetch(`${BASE}/api/log?layout_id=restaurant_candidate_v1&limit=50`).then((r) => r.json());

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + JSON.stringify(detail) : ''));
}

try {
  let target;
  for (let k = 0; k < 40 && !target; k++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {}
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));
  ws.on('message', (m) => {
    const d = JSON.parse(m);
    if (d.id && pending.has(d.id)) { pending.get(d.id).res(d.result || {}); pending.delete(d.id); }
    if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.args.map((a) => a.value).join(' '));
    if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails).slice(0, 300));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}/product.html` });
  await waitFor('!!window.__product');
  const before = (await lastLog()).length;
  check('单一 Three 实例', await evalJs('window.__product.threeRevision') === '187' && await evalJs('typeof window.THREE') === 'undefined');
  await shot('01-ready.png');

  // 1. 成功
  await ask('帮我把红色水杯放到3号桌上');
  await waitFor(`document.querySelector('.ht-task-pill')?.textContent.includes('完成')`, 120000);
  await sleep(600);
  let st = await evalJs('window.__product.state()');
  check('成功：杯子落在 3 号桌', st.cupParent === 'furniture:table_03' && st.holding === null, st);
  await shot('02-success.png');
  await waitFor(`document.getElementById('banner').className === 'ok'`, 10000);
  let log = await lastLog();
  check('成功：/log 新增 1 条、3 步 succeeded', log.length === before + 1, log[0]);

  // 2. 执行失败
  await evalJs(`document.getElementById('btn-fail').click(), true`);
  await waitFor(`document.querySelector('.ht-task-pill')?.textContent.includes('失败')`, 120000);
  await sleep(800);
  st = await evalJs('window.__product.state()');
  check('失败：HUD 显示失败、杯子回到 3 号桌、空手', st.cupParent === 'furniture:table_03' && st.holding === null && st.sm === 'idle', st);
  await shot('03-failed.png');
  log = await lastLog();
  check('失败：/log 新增 1 条', log.length === before + 2, log[0]);

  // 3. 取消（抓取中）
  await ask('帮我把红色水杯放到2号桌上');
  await waitFor(`window.__product.ctx.sm.state === 'picking'`, 120000);
  await evalJs(`document.getElementById('btn-cancel').click(), true`);
  await waitFor(`!window.__product.loop.busy`, 30000);
  await sleep(800);
  st = await evalJs('window.__product.state()');
  check('取消：holding 与挂载一致、锁释放、idle', st.holding === 'cup_red' && st.cupParent === 'carryAnchor' && !st.handBusy && st.sm === 'idle', st);
  await shot('04-cancelled.png');
  log = await lastLog();
  check('取消：/log 新增 1 条', log.length === before + 3, log[0]);

  fs.writeFileSync(path.join(OUT, 'product-e2e.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results, console: logs.slice(-40) }, null, 2));
} catch (e) {
  console.error('E2E 中断：', e.message);
  console.error(logs.slice(-20).join('\n'));
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}
if (results.some((r) => !r.ok)) process.exitCode = 1;
