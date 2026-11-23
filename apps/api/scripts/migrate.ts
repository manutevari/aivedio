import pg from "pg";
import {createHash} from "node:crypto";
import {readdir,readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const {Pool}=pg;
const connectionString=process.env.DATABASE_URL;
if(!connectionString)throw new Error("DATABASE_URL is required to run migrations");

const pool=new Pool({connectionString,max:1});
const migrationsDir=fileURLToPath(new URL("../src/migrations/",import.meta.url));

async function main(){
 const client=await pool.connect();
 try{
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(194829314)");
  await client.query(`CREATE TABLE IF NOT EXISTS aivedio_schema_migrations(
   filename TEXT PRIMARY KEY,
   checksum TEXT NOT NULL,
   applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const files=(await readdir(migrationsDir)).filter(name=>/^\d+_[a-z0-9_-]+\.sql$/i.test(name)).sort();
  if(!files.length)throw new Error("No SQL migration files were found");
  for(const filename of files){
   const source=await readFile(new URL("../src/migrations/"+filename,import.meta.url),"utf8");
   const checksum=createHash("sha256").update(source).digest("hex");
   const prior=await client.query("SELECT checksum FROM aivedio_schema_migrations WHERE filename=$1",[filename]);
   if(prior.rowCount){
    if(prior.rows[0].checksum!==checksum)throw new Error("Applied migration was modified: "+filename);
    console.log("Already applied: "+filename);
    continue;
   }
   await client.query(source);
   await client.query("INSERT INTO aivedio_schema_migrations(filename,checksum) VALUES($1,$2)",[filename,checksum]);
   console.log("Applied: "+filename);
  }
  await client.query("COMMIT");
  console.log("AIVEDIO migrations are current.");
 }catch(error){
  await client.query("ROLLBACK");
  throw error;
 }finally{
  client.release();
 }
}

try{await main()}finally{await pool.end()}
