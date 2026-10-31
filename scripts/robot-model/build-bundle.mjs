import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from 'node:url';import * as T from 'three';import{build}from 'esbuild';
const here=path.dirname(fileURLToPath(import.meta.url));
const shim=path.join(here,'three-global.mjs');fs.writeFileSync(shim,Object.keys(T).map(n=>'export const '+n+' = window.THREE.'+n+';').join('\n'));
await build({entryPoints:[path.join(here,'model-visual.mjs')],bundle:true,format:'iife',minify:true,plugins:[{name:'existing-global-three',setup(b){b.onResolve({filter:/^three$/},()=>({path:shim}));}}],outfile:path.resolve(here,'../../web/public/robot-find/vendor/robot-model.js'),banner:{js:'/* User robot FBX visual adapter; GLTFLoader from Three 0.160.1 (MIT). Uses existing window.THREE r160. Source: model-visual.mjs. */'}});
