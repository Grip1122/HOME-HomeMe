import fs from 'node:fs';
import path from 'node:path';
const inputPath=process.argv[2], textureDir=process.argv[3], outputDir=process.argv[4];
if(!inputPath||!textureDir||!outputDir)throw Error('Usage: node --max-old-space-size=8192 convert-fbx.mjs robot.fbx texture-directory output-directory');
import crypto from 'node:crypto';
import * as T from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier as simplify } from 'meshoptimizer';
globalThis.window={URL};
T.TextureLoader.prototype.load=function(url){const t=new T.Texture();t.userData.sourceURL=url;t.image={src:url};return t;};
const input=fs.readFileSync(inputPath);
const root=new FBXLoader().parse(input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength),'');
root.updateMatrixWorld(true);
let mesh;root.traverse(o=>{if(o.isMesh){if(mesh)throw Error('Expected one source mesh');mesh=o;}});
let geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
console.log('Welding vertices',geo.attributes.position.count);
geo=mergeVertices(geo,1e-5);
console.log('Indexed vertices',geo.attributes.position.count);
await simplify.ready;
const originalIndices=new Uint32Array(geo.index.array), pos=geo.attributes.position.array;
const attrs=new Float32Array(geo.attributes.position.count*5);
for(let i=0;i<geo.attributes.position.count;i++){attrs.set(geo.attributes.normal.array.subarray(i*3,i*3+3),i*5);attrs.set(geo.attributes.uv.array.subarray(i*2,i*2+2),i*5+3);}
const target=120000*3;
const [indices,error]=simplify.simplifyWithAttributes(originalIndices,pos,3,attrs,5,[.1,.1,.1,.5,.5],null,target,.003,[]);
console.log('Simplified triangles',indices.length/3,'error',error);
const [remap,vertexCount]=simplify.compactMesh(indices);
const attributes={};
for(const [name,a] of Object.entries(geo.attributes)){const out=new Float32Array(vertexCount*a.itemSize);for(let i=0;i<remap.length;i++){if(remap[i]===0xffffffff)continue;out.set(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize),remap[i]*a.itemSize);}attributes[name]={array:out,itemSize:a.itemSize};}
const sourceBounds=new T.Box3().setFromBufferAttribute(geo.attributes.position),center=sourceBounds.getCenter(new T.Vector3());
// Preserve the original Y-up pose and normalize only translation. Runtime sets explicit display height.
const positions=attributes.position.array;
for(let i=0;i<positions.length;i+=3){positions[i]-=center.x;positions[i+1]-=sourceBounds.min.y;positions[i+2]-=center.z;}
const chunks=[],views=[],accessors=[];let byteLength=0;
function addBytes(bytes,target){const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const id=views.length;views.push({buffer:0,byteOffset:byteLength,byteLength:bytes.byteLength,...(target?{target}:{})});chunks.push(Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength));byteLength+=bytes.byteLength;return id;}
function addAccessor(array,itemSize,type,target){const view=addBytes(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),target);const a={bufferView:view,componentType:type,count:array.length/itemSize,type:({1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'})[itemSize]};if(target===34962&&itemSize===3){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<array.length;i++){min[i%3]=Math.min(min[i%3],array[i]);max[i%3]=Math.max(max[i%3],array[i]);}a.min=min;a.max=max;}accessors.push(a);return accessors.length-1;}
const attributeDefs={};for(const [name,gltf]of [['position','POSITION'],['normal','NORMAL'],['uv','TEXCOORD_0']]){const a=attributes[name];if(!a)continue;if(name==='uv'){for(let i=1;i<a.array.length;i+=2)a.array[i]=1-a.array[i];}attributeDefs[gltf]=addAccessor(a.array,a.itemSize,5126,34962);}
const indexAccessor=addAccessor(indices,1,5125,34963);
const texRoot=textureDir;
const textureReport=[];const images=[];
for(const [slot,name]of [['baseColor','vizcom_texture_12.png'],['normal','vizcom_texture_11.png']]){const b=fs.readFileSync(path.join(texRoot,name));images.push({bufferView:addBytes(b),mimeType:'image/png',name});textureReport.push({slot,name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i++){min[i%3]=Math.min(min[i%3],positions[i]);max[i%3]=Math.max(max[i%3],positions[i]);}
const json={asset:{version:'2.0',generator:'HOME user FBX conversion; Three 0.160.1 + meshoptimizer 0.25'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'robot_fbx_visual',mesh:0}],meshes:[{name:'vizcom_node_0001',primitives:[{attributes:attributeDefs,indices:indexAccessor,material:0}]}],materials:[{name:'robot_fbx_surface',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.7},normalTexture:{index:1,scale:1},doubleSided:false}],textures:[{sampler:0,source:0},{sampler:0,source:1}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],images,accessors,bufferViews:views,buffers:[{byteLength}]};
const bin=Buffer.concat(chunks);const raw=Buffer.from(JSON.stringify(json)),jpad=(4-raw.length%4)%4,j=Buffer.concat([raw,Buffer.alloc(jpad,32)]),bpad=(4-bin.length%4)%4,b=Buffer.concat([bin,Buffer.alloc(bpad)]);
const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+j.length+8+b.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(j.length);jh.writeUInt32LE(0x4e4f534a,4);const bh=Buffer.alloc(8);bh.writeUInt32LE(b.length);bh.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,jh,j,bh,b]);fs.mkdirSync(outputDir,{recursive:true});fs.writeFileSync(path.join(outputDir,'robot-web.glb'),glb);
const report={source:{file:'robot.fbx',bytes:input.length,sha256:crypto.createHash('sha256').update(input).digest('hex')},output:{file:'robot-web.glb',bytes:glb.length,sha256:crypto.createHash('sha256').update(glb).digest('hex'),triangles:indices.length/3,vertices:vertexCount,bounds:{min,max,size:max.map((n,i)=>n-min[i])}},conversion:{sourceTriangles:originalIndices.length/3,indexedVertices:pos.length/3,targetTriangles:120000,targetError:.003,actualError:error,algorithm:'meshoptimizer simplifyWithAttributes',weights:[.1,.1,.1,.5,.5],sourceTranslation:[center.x,sourceBounds.min.y,center.z],uvVFlipped:true,baseColorFactor:[1,1,1,1],roughness:.7,metalness:0},textures:textureReport,rig:{bones:0,animationClips:0,jointMotionAvailable:false}};
fs.writeFileSync(path.join(outputDir,'conversion.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
