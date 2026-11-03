// 只准备/验证云端结构，不会把现有 APP 自动切换到 Supabase。
import {readFile} from 'node:fs/promises';
const uri=process.env.SUPABASE_DATABASE_URL;
if(!uri){console.error('未配置 SUPABASE_DATABASE_URL；未连接云端，未修改任何数据库。');process.exit(1);}
const {default:pg}=await import('pg');
const apply=process.argv.includes('--apply');
const client=new pg.Client({connectionString:uri,connectionTimeoutMillis:15000,application_name:'yuguang-setup'});
try{
 await client.connect();
 if(apply){
  await client.query('BEGIN');
  try{await client.query(await readFile(new URL('../supabase/migrations/202610280001_mvp0.sql',import.meta.url),'utf8'));await client.query('COMMIT');}
  catch(e){await client.query('ROLLBACK');throw e;}
 }
 const result=await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='yuguang' ORDER BY table_name");
 console.log(JSON.stringify({connected:true,migrationApplied:apply,businessTables:result.rows.map(x=>x.table_name),appStillUsesSQLite:true},null,2));
}catch(e){console.error('Supabase 准备未完成：',e.code||'连接或迁移错误','（未输出连接凭据）');process.exitCode=1;}
finally{await client.end().catch(()=>{});}
