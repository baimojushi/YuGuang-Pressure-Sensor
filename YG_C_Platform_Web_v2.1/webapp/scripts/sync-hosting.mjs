import {readFile,writeFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),check=process.argv.includes('--check'),siteAt=process.argv.indexOf('--site'),site=siteAt>=0?path.resolve(root,process.argv[siteAt+1]):null;
const targets=[path.join(root,'hosting'),...(site?[site]:[])];
let differences=[];
async function syncFile(src,dest){const value=await readFile(src);if(check){try{if(!(await readFile(dest)).equals(value))differences.push(dest);}catch{differences.push(dest);}return;}await mkdir(path.dirname(dest),{recursive:true});await copyFile(src,dest);}
async function tree(src,dest){for(const e of await readdir(src,{withFileTypes:true})){if(e.isDirectory())await tree(path.join(src,e.name),path.join(dest,e.name));else if(e.isFile())await syncFile(path.join(src,e.name),path.join(dest,e.name));}}
for(const dest of targets){for(const dir of ['public','shared'])await tree(path.join(root,dir),path.join(dest,dir));for(const [src,target]of [['adapters/cloud-api.mjs','app/cloud-api.mjs'],['adapters/route.ts','app/route.ts'],['adapters/schema.ts','db/schema.ts'],['tests/contract.mjs','tests/contract.mjs'],['tests/cloud-entry.mjs','tests/cloud.test.mjs'],['tests/care-ack.test.js','tests/care-ack.test.mjs']])await syncFile(path.join(root,src),path.join(dest,target));
 const html='export const html = '+JSON.stringify(await readFile(path.join(root,'public/index.html'),'utf8'))+';\n',demo="export {GET} from '../route';\n";for(const [name,value]of [['app/html.ts',html],['app/demo/route.ts',demo]]){const p=path.join(dest,name);if(check){try{if(await readFile(p,'utf8')!==value)differences.push(p);}catch{differences.push(p);}}else{await mkdir(path.dirname(p),{recursive:true});await writeFile(p,value);}}
}
if(differences.length){console.error('生成文件未同步，请运行 npm run sync:hosting\n'+differences.join('\n'));process.exit(1);}console.log(check?'同源文件校验通过':'已同步正式版与展示版共用的部署文件');
