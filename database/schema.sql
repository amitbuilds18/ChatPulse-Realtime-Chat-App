-- ==========================================================
-- ChatPulse: Real-Time Chat Application Database Schema
-- CodeCraft Infotech Internship – Task 04
-- Database Engine: PostgreSQL / Neon Serverless Postgres
-- Schema: chat (Isolated schema preventing collisions)
-- ==========================================================

-- 1. Ensure isolated chat schema exists
CREATE SCHEMA IF NOT EXISTS chat;
SET search_path TO chat, public;

-- 2. Enable UUID extension for cryptographically secure UUID primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS chat.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT DEFAULT NULL,
    status_text VARCHAR(150) DEFAULT 'Hey there! I am using ChatPulse.',
    phone_verified BOOLEAN DEFAULT false,
    otp_code VARCHAR(10) DEFAULT NULL,
    otp_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON chat.users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON chat.users (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_name ON chat.users(LOWER(name));

-- 4. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS chat.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
    title VARCHAR(150) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    is_public BOOLEAN DEFAULT true,
    created_by UUID REFERENCES chat.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CONVERSATION MEMBERS TABLE (Junction Table)
CREATE TABLE IF NOT EXISTS chat.conversation_members (
    conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES chat.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON chat.conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON chat.conversation_members(conversation_id);

-- 6. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS chat.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES chat.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio')),
    file_url TEXT DEFAULT NULL,
    file_name VARCHAR(255) DEFAULT NULL,
    file_size INTEGER DEFAULT NULL,
    reactions JSONB DEFAULT '{}'::jsonb,
    is_starred BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON chat.messages(sender_id);

-- ==========================================================
-- 7. DEFAULT SEED DATA (Demo Users & Public Rooms)
-- ==========================================================

-- Seed Demo Users (Password: password123)
INSERT INTO chat.users (name, phone, email, password_hash, avatar_url, status_text)
VALUES
    ('Amit Kumar', '+919876543210', 'amit@codecraft.com', '$2b$10$FD6ploIF5.Rpej9Qlr5WW.lo8Mi.GU.iTgBxCvXtX4x3Ne4buP4IG', 'https://api.dicebear.com/7.x/bottts/svg?seed=amit', '🟢 Available'),
    ('Rahul Sharma', '+919123456789', 'rahul@codecraft.com', '$2b$10$FD6ploIF5.Rpej9Qlr5WW.lo8Mi.GU.iTgBxCvXtX4x3Ne4buP4IG', 'https://api.dicebear.com/7.x/bottts/svg?seed=rahul', '💻 Coding...'),
    ('Priya Patel', '+919988776655', 'priya@codecraft.com', '$2b$10$FD6ploIF5.Rpej9Qlr5WW.lo8Mi.GU.iTgBxCvXtX4x3Ne4buP4IG', 'https://api.dicebear.com/7.x/bottts/svg?seed=priya', '🚀 Building apps')
ON CONFLICT DO NOTHING;

-- Seed Public Group Rooms
INSERT INTO chat.conversations (type, title, description, is_public)
VALUES
    ('group', '🌐 General Discussion', 'Open public room for all interns and developers', true),
    ('group', '🚀 CodeCraft Interns Hub', 'Collaborate, share code snippets and internship tasks', true)
ON CONFLICT DO NOTHING;

-- Add all users into the public rooms
INSERT INTO chat.conversation_members (conversation_id, user_id)
SELECT c.id, u.id
FROM chat.conversations c
CROSS JOIN chat.users u
WHERE c.type = 'group' AND c.is_public = true
ON CONFLICT DO NOTHING;
