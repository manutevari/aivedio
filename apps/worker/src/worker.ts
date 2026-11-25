import {claimNextJob,executeJob,failOrRetry,pool} from "./queue.js";
import {registeredAdapterIds} from "./adapters.js";
const pollMs=Number(process.env.WORKER_POLL_MS??3000);let stopped=false;
process.on("SIGINT",()=>{stopped=true});process.on("SIGTERM",()=>{stopped=true});
async function main(){const adapters=registeredAdapterIds();console.log("AIVEDIO worker started. Provider adapters registered:",adapters.length,adapters);if(!adapters.length)console.error("CRITICAL: no reviewed generation provider adapters are registered; generation jobs will remain queued");try{while(!stopped){try{const job=await claimNextJob();if(job){try{await executeJob(job)}catch(e){await failOrRetry(job,e);console.error("Job failed",job.id,e)}continue}}catch(e){console.error("Worker loop error",e)}await new Promise(r=>setTimeout(r,pollMs))}}finally{await pool.end()}}
main().catch(e=>{console.error(e);process.exitCode=1});
