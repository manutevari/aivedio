import pg from "pg";
const {Pool}=pg;
export const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==="require"?{rejectUnauthorized:false}:undefined}):null;
export function requireDb(){if(!pool)throw new Error("DATABASE_URL is not configured");return pool;}
