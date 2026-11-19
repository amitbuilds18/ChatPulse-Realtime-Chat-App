import path from "path";
import dotenv from "dotenv";

// Explicitly resolve the server's .env file path regardless of working directory
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });
dotenv.config(); // fallback to default

export const PORT = Number(process.env.PORT) || 5001;
export const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
export const JWT_SECRET = process.env.JWT_SECRET || "chatpulse_jwt_secret_dev_key_2026_ccinfotech";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_wOcIWUEn6B7D@ep-dry-mountain-a78d00b3-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require";
export const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
