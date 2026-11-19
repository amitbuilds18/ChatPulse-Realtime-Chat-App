import { Pool, PoolConfig } from "pg";
import { DATABASE_URL } from "./env";

const poolConfig: PoolConfig = {
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000
};

export const pool = new Pool(poolConfig);

// Set search_path to 'chat, public' on every new client connection
pool.on("connect", (client) => {
  client.query("SET search_path TO chat, public").catch(() => {});
});

pool.on("error", (err: Error) => {
  console.error("❌ Unexpected idle PostgreSQL client error:", err.message);
});

export default pool;
