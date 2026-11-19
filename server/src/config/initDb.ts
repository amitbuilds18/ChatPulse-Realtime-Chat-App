import fs from "fs";
import path from "path";
import pool from "./db";
import { seedDemoUsers } from "./seed";

async function ensureUserTableSchema(client: any): Promise<void> {
  const columnRes = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'chat' AND table_name = 'users';
  `);

  const existingColumns = new Set(columnRes.rows.map((row: { column_name: string }) => row.column_name));

  const migrationStatements = [
    ["avatar_url", "ALTER TABLE chat.users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;"],
    ["phone_verified", "ALTER TABLE chat.users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;"],
    ["otp_code", "ALTER TABLE chat.users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10) DEFAULT NULL;"],
    ["otp_expires_at", "ALTER TABLE chat.users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;"],
    ["email", "ALTER TABLE chat.users ADD COLUMN IF NOT EXISTS email VARCHAR(255) DEFAULT NULL;"],
    ["password_hash", "ALTER TABLE chat.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) DEFAULT NULL;"],
    ["status_text", "ALTER TABLE chat.users ADD COLUMN IF NOT EXISTS status_text VARCHAR(150) DEFAULT 'Hey there! I am using ChatPulse.';"]
  ] as const;

  for (const [columnName, statement] of migrationStatements) {
    if (!existingColumns.has(columnName)) {
      await client.query(statement);
      existingColumns.add(columnName);
    }
  }

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
    ON chat.users (phone)
    WHERE phone IS NOT NULL;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON chat.users (LOWER(email))
    WHERE email IS NOT NULL;
  `);
}

async function ensureConversationsAndMessagesSchema(client: any): Promise<void> {
  // 1. Conversations columns
  const convColumns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'chat' AND table_name = 'conversations';
  `);
  const existingConvCols = new Set(convColumns.rows.map((r: any) => r.column_name));

  if (!existingConvCols.has("title")) {
    await client.query("ALTER TABLE chat.conversations ADD COLUMN IF NOT EXISTS title VARCHAR(150) DEFAULT NULL;");
  }
  if (!existingConvCols.has("description")) {
    await client.query("ALTER TABLE chat.conversations ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;");
  }
  if (!existingConvCols.has("is_public")) {
    await client.query("ALTER TABLE chat.conversations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;");
  }
  if (!existingConvCols.has("created_by")) {
    await client.query("ALTER TABLE chat.conversations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES chat.users(id) ON DELETE SET NULL;");
  }

  // 2. Messages columns
  const msgColumns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'chat' AND table_name = 'messages';
  `);
  const existingMsgCols = new Set(msgColumns.rows.map((r: any) => r.column_name));

  if (!existingMsgCols.has("message_type")) {
    await client.query("ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) DEFAULT 'text';");
  }
  if (!existingMsgCols.has("file_url")) {
    await client.query("ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS file_url TEXT DEFAULT NULL;");
  }
  if (!existingMsgCols.has("file_name")) {
    await client.query("ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) DEFAULT NULL;");
  }
  if (!existingMsgCols.has("file_size")) {
    await client.query("ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT NULL;");
  }
  if (!existingMsgCols.has("reactions")) {
    await client.query("ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;");
  }
  if (!existingMsgCols.has("is_starred")) {
    await client.query("ALTER TABLE chat.messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT false;");
  }
  try {
    await client.query("ALTER TABLE chat.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;");
  } catch (e) {
    // ignore
  }

  // 3. Seed Default Public Rooms if not present
  const existingRooms = await client.query(`
    SELECT id, title FROM chat.conversations WHERE type = 'group' AND is_public = true;
  `);

  if (existingRooms.rows.length === 0) {
    const r1 = await client.query(`
      INSERT INTO chat.conversations (type, title, description, is_public)
      VALUES ('group', '🌐 General Discussion', 'Open public room for all interns and developers', true)
      RETURNING id;
    `);

    const r2 = await client.query(`
      INSERT INTO chat.conversations (type, title, description, is_public)
      VALUES ('group', '🚀 CodeCraft Interns Hub', 'Collaborate, share code snippets and internship tasks', true)
      RETURNING id;
    `);

    // Add all existing users to default public rooms so they can talk right away!
    const allUsers = await client.query("SELECT id FROM chat.users;");
    for (const u of allUsers.rows) {
      await client.query(`
        INSERT INTO chat.conversation_members (conversation_id, user_id)
        VALUES ($1, $2), ($3, $2)
        ON CONFLICT DO NOTHING;
      `, [r1.rows[0].id, u.id, r2.rows[0].id]);
    }

    console.log("✅ Seeded default public group rooms: General Discussion & CodeCraft Interns Hub");
  }
}

export async function initDatabase(): Promise<boolean> {
  const client = await pool.connect();
  try {
    console.log("🔄 Initializing PostgreSQL database tables for ChatPulse...");

    const schemaPath = path.resolve(__dirname, "../../../database/schema.sql");
    let sql: string;

    if (fs.existsSync(schemaPath)) {
      sql = fs.readFileSync(schemaPath, "utf-8");
    } else {
      // Fallback inline DDL if path resolution changes
      sql = `
        CREATE SCHEMA IF NOT EXISTS chat;
        SET search_path TO chat, public;
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS chat.users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(20) UNIQUE DEFAULT NULL,
            email VARCHAR(255) UNIQUE DEFAULT NULL,
            password_hash VARCHAR(255) NOT NULL,
            avatar_url TEXT DEFAULT NULL,
            phone_verified BOOLEAN DEFAULT false,
            otp_code VARCHAR(10) DEFAULT NULL,
            otp_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat.conversations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat.conversation_members (
            conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES chat.users(id) ON DELETE CASCADE,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (conversation_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS chat.messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
            sender_id UUID NOT NULL REFERENCES chat.users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
    }

    await client.query(sql);
    await ensureUserTableSchema(client);
    await ensureConversationsAndMessagesSchema(client);

    // Verify all 4 tables exist in chat schema
    const verifyRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'chat'
      ORDER BY table_name;
    `);

    const tables = verifyRes.rows.map(r => r.table_name);
    console.log("✅ Database schema initialized successfully in schema [chat]:", tables);
    await seedDemoUsers();
    return true;
  } catch (error: any) {
    console.error("❌ Database initialization error:", error.message);
    return false;
  } finally {
    client.release();
  }
}

// Allow standalone execution: npx tsx src/config/initDb.ts
if (require.main === module) {
  initDatabase().then(() => {
    pool.end();
  });
}
