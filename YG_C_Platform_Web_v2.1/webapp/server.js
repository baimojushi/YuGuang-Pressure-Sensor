import express from 'express';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {handle} from './shared/backend.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const dir=path.resolve(process.env.DATA_DIR||path.join(root,'data-v2'));
await mkdir(path.join(dir,'audio'),{recursive:true});
// V2 separates physical databases. Original V1 data is never deleted or seeded into live.
function database(name){const sql=new DatabaseSync(path.join(dir,name+'.sqlite'));sql.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY,payload TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0)');return {prepare(query){return {bind(...args){return {async first(){return sql.prepare(query).get(...args)||null;},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};}
const live=database('live'),demo=database('demo');
const cloud={LIVE_STORAGE:process.env.LIVE_STORAGE,SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_SECRET_KEY:process.env.SUPABASE_SECRET_KEY,SUPABASE_AUDIO_BUCKET:process.env.SUPABASE_AUDIO_BUCKET,CARE_ACK_BRIDGE_SECRET:process.env.CARE_ACK_BRIDGE_SECRET,CARE_DISPLAY_BRIDGE_SECRET:process.env.CARE_DISPLAY_BRIDGE_SECRET,VOICE_READ_BRIDGE_SECRET:process.env.VOICE_READ_BRIDGE_SECRET,LIGHT_MAPPER_URL:process.env.LIGHT_MAPPER_URL,LIGHT_MAPPER_TOKEN:process.env.LIGHT_MAPPER_TOKEN};
const fileFor=k=>path.join(dir,'audio',encodeURIComponent(k));
const BUCKET={async put(k,data){await writeFile(fileFor(k),new Uint8Array(data));},async get(k){try{return {body:new Uint8Array(await readFile(fileFor(k)))}}catch(e){if(e.code==='ENOENT')return null;throw e;}},async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])try{await unlink(fileFor(k));}catch(e){if(e.code!=='ENOENT')throw e;}}};
const app=express();app.disable('x-powered-by');
app.use('/api',express.raw({type:()=>true,limit:'6mb'}),async(req,res)=>{try{const original=req.originalUrl,isDemo=/^\/api\/demo(?:\/|$)/.test(original),headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);const request=new Request('http://'+req.get('host')+original,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body});const response=await handle(request,{...cloud,DB:isDemo?demo:live,BUCKET,AUTH_PROVIDER:'password',STORAGE_LABEL:'SQLite'});res.status(response.status);response.headers.forEach((v,k)=>res.setHeader(k,v));res.send(Buffer.from(await response.arrayBuffer()));}catch(e){console.error(e.message);res.status(500).json({error:'服务暂时不可用'});}});
app.get(['/','/demo','/demo/'],(req,res)=>res.sendFile(path.join(root,'public/index.html')));
app.use(express.static(path.join(root,'public'),{setHeaders:res=>res.setHeader('Cache-Control','no-cache')}));
app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.status===413?'上传文件过大':'请求未完成'}));
const port=Number(process.env.PORT||3100);app.listen(port,'0.0.0.0',()=>console.log('余光正式版 http://localhost:'+port+'/ · 展示版 http://localhost:'+port+'/demo · 数据目录 '+dir));
