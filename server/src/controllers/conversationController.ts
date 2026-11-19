import { Response } from "express";
import pool from "../config/db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

// ==========================================================
// 1. Direct 1-on-1 Conversation (Get or Create)
// ==========================================================
export async function getOrCreateConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const client = await pool.connect();
  try {
    const currentUserId = req.user?.id;
    const { recipientId } = req.body;

    if (!recipientId) {
      res.status(400).json({ error: "recipientId is required." });
      return;
    }

    if (recipientId === currentUserId) {
      res.status(400).json({ error: "Cannot create a conversation with yourself." });
      return;
    }

    // Verify recipient exists
    const recipientCheck = await client.query(
      "SELECT id, name, phone, email, avatar_url, COALESCE(status_text, 'Hey there! I am using ChatPulse.') AS status_text FROM chat.users WHERE id = $1",
      [recipientId]
    );

    if (recipientCheck.rows.length === 0) {
      res.status(404).json({ error: "Recipient user not found." });
      return;
    }

    const recipient = recipientCheck.rows[0];

    // Check if direct conversation already exists between these 2 users
    const existingConvQuery = `
      SELECT c.id, c.type, c.created_at
      FROM chat.conversations c
      JOIN chat.conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = $1
      JOIN chat.conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = $2
      WHERE c.type = 'direct'
      LIMIT 1;
    `;
    const existingConv = await client.query(existingConvQuery, [currentUserId, recipientId]);

    if (existingConv.rows.length > 0) {
      res.status(200).json({
        conversation: {
          ...existingConv.rows[0],
          participant: recipient
        }
      });
      return;
    }

    // Otherwise, create new conversation atomically
    await client.query("BEGIN");

    const newConvRes = await client.query(
      "INSERT INTO chat.conversations (type) VALUES ('direct') RETURNING id, type, created_at"
    );
    const newConv = newConvRes.rows[0];

    await client.query(
      `INSERT INTO chat.conversation_members (conversation_id, user_id)
       VALUES ($1, $2), ($1, $3)`,
      [newConv.id, currentUserId, recipientId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      conversation: {
        ...newConv,
        participant: recipient
      }
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("GetOrCreateConversation Error:", error);
    res.status(500).json({ error: "Failed to create conversation.", detail: error.message });
  } finally {
    client.release();
  }
}

// ==========================================================
// 2. Create Group Chat Room
// ==========================================================
export async function createRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  const client = await pool.connect();
  try {
    const currentUserId = req.user?.id;
    const { title, description, isPublic = true } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: "Room title is required." });
      return;
    }

    await client.query("BEGIN");

    const convRes = await client.query(
      `INSERT INTO chat.conversations (type, title, description, is_public, created_by)
       VALUES ('group', $1, $2, $3, $4)
       RETURNING id, type, title, description, is_public, created_by, created_at`,
      [title.trim(), (description || "").trim(), Boolean(isPublic), currentUserId]
    );
    const newRoom = convRes.rows[0];

    // Add creator as member
    await client.query(
      `INSERT INTO chat.conversation_members (conversation_id, user_id)
       VALUES ($1, $2)`,
      [newRoom.id, currentUserId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      conversation: {
        ...newRoom,
        member_count: 1,
        avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(newRoom.title)}`
      }
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("CreateRoom Error:", error);
    res.status(500).json({ error: "Failed to create room.", detail: error.message });
  } finally {
    client.release();
  }
}

// ==========================================================
// 3. List All Available Public Rooms
// ==========================================================
export async function getPublicRooms(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;

    const query = `
      SELECT 
        c.id,
        c.type,
        c.title,
        c.description,
        c.is_public,
        c.created_at,
        (SELECT COUNT(*)::int FROM chat.conversation_members cm WHERE cm.conversation_id = c.id) AS member_count,
        EXISTS(
          SELECT 1 FROM chat.conversation_members cm_check 
          WHERE cm_check.conversation_id = c.id AND cm_check.user_id = $1
        ) AS is_member
      FROM chat.conversations c
      WHERE c.type = 'group' AND c.is_public = true
      ORDER BY c.created_at DESC;
    `;

    const result = await pool.query(query, [currentUserId]);
    const rooms = result.rows.map(r => ({
      ...r,
      avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(r.title || r.id)}`
    }));

    res.status(200).json({ rooms });
  } catch (error: any) {
    console.error("GetPublicRooms Error:", error);
    res.status(500).json({ error: "Failed to fetch public rooms.", detail: error.message });
  }
}

// ==========================================================
// 4. Join a Group Room
// ==========================================================
export async function joinRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;
    const { id } = req.params;

    // Check if room exists and is group
    const roomCheck = await pool.query(
      "SELECT id, type, title, description, is_public FROM chat.conversations WHERE id = $1",
      [id]
    );

    if (roomCheck.rows.length === 0) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    const room = roomCheck.rows[0];

    // Join member
    await pool.query(
      `INSERT INTO chat.conversation_members (conversation_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [id, currentUserId]
    );

    const countRes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM chat.conversation_members WHERE conversation_id = $1",
      [id]
    );

    res.status(200).json({
      conversation: {
        ...room,
        member_count: countRes.rows[0].count,
        avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(room.title || room.id)}`
      }
    });
  } catch (error: any) {
    console.error("JoinRoom Error:", error);
    res.status(500).json({ error: "Failed to join room.", detail: error.message });
  }
}

// ==========================================================
// 5. List All Conversations (Direct Chats + Joined Group Rooms)
// ==========================================================
export async function getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;

    const query = `
      SELECT 
        c.id,
        c.type,
        c.title,
        c.description,
        c.is_public,
        c.created_at,
        u.id AS participant_id,
        u.name AS participant_name,
        u.phone AS participant_phone,
        u.email AS participant_email,
        u.avatar_url AS participant_avatar,
        COALESCE(u.status_text, 'Hey there! I am using ChatPulse.') AS participant_status,
        (SELECT COUNT(*)::int FROM chat.conversation_members cm_cnt WHERE cm_cnt.conversation_id = c.id) AS member_count,
        lm.content AS last_message_content,
        lm.message_type AS last_message_type,
        lm.file_url AS last_message_file_url,
        lm.created_at AS last_message_time,
        lm.sender_id AS last_message_sender_id,
        lm_sender.name AS last_message_sender_name
      FROM chat.conversations c
      JOIN chat.conversation_members cm_me ON c.id = cm_me.conversation_id AND cm_me.user_id = $1
      LEFT JOIN chat.conversation_members cm_other ON c.id = cm_other.conversation_id AND cm_other.user_id != $1 AND c.type = 'direct'
      LEFT JOIN chat.users u ON cm_other.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT m.content, m.message_type, m.file_url, m.created_at, m.sender_id
        FROM chat.messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN chat.users lm_sender ON lm.sender_id = lm_sender.id
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
    `;

    const result = await pool.query(query, [currentUserId]);

    const formatted = result.rows.map(row => {
      const isGroup = row.type === "group";
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        is_public: row.is_public,
        member_count: row.member_count,
        created_at: row.created_at,
        avatar_url: isGroup
          ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(row.title || row.id)}`
          : (row.participant_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.participant_email || row.id}`),
        participant: !isGroup ? {
          id: row.participant_id,
          name: row.participant_name,
          phone: row.participant_phone,
          email: row.participant_email,
          avatar_url: row.participant_avatar,
          status_text: row.participant_status
        } : null,
        last_message: (row.last_message_content || row.last_message_file_url) ? {
          content: row.last_message_type === "image" ? "📷 [Photo / Image]" : row.last_message_type === "audio" ? "🎙️ [Voice Audio Note]" : row.last_message_content,
          message_type: row.last_message_type || "text",
          file_url: row.last_message_file_url,
          created_at: row.last_message_time,
          sender_id: row.last_message_sender_id,
          sender_name: row.last_message_sender_name
        } : null
      };
    });

    res.status(200).json({ conversations: formatted });
  } catch (error: any) {
    console.error("GetConversations Error:", error);
    res.status(500).json({ error: "Failed to fetch conversations.", detail: error.message });
  }
}

// ==========================================================
// 6. Get Single Conversation Details
// ==========================================================
export async function getConversationById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;
    const { id } = req.params;

    // Check membership
    const memberCheck = await pool.query(
      "SELECT conversation_id FROM chat.conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [id, currentUserId]
    );

    if (memberCheck.rows.length === 0) {
      res.status(403).json({ error: "Access denied. You are not a member of this conversation." });
      return;
    }

    const convRes = await pool.query(
      `SELECT id, type, title, description, is_public, created_at,
        (SELECT COUNT(*)::int FROM chat.conversation_members WHERE conversation_id = $1) AS member_count
       FROM chat.conversations
       WHERE id = $1`,
      [id]
    );

    if (convRes.rows.length === 0) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const conv = convRes.rows[0];

    if (conv.type === "group") {
      res.status(200).json({
        conversation: {
          ...conv,
          avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(conv.title || conv.id)}`
        }
      });
      return;
    }

    // Direct chat: fetch other participant
    const otherRes = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.avatar_url, COALESCE(u.status_text, 'Hey there! I am using ChatPulse.') AS status_text
       FROM chat.conversation_members cm
       JOIN chat.users u ON cm.user_id = u.id
       WHERE cm.conversation_id = $1 AND cm.user_id != $2
       LIMIT 1`,
      [id, currentUserId]
    );

    const participant = otherRes.rows[0] || null;

    res.status(200).json({
      conversation: {
        ...conv,
        participant
      }
    });
  } catch (error: any) {
    console.error("GetConversationById Error:", error);
    res.status(500).json({ error: "Failed to fetch conversation.", detail: error.message });
  }
}

// ==========================================================
// 7. Get Message History (With Multimedia Fields)
// ==========================================================
export async function getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;
    const { id } = req.params;

    // Verify membership
    const memberCheck = await pool.query(
      "SELECT 1 FROM chat.conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [id, currentUserId]
    );

    if (memberCheck.rows.length === 0) {
      res.status(403).json({ error: "Access denied. You are not a member of this conversation." });
      return;
    }

    const messagesQuery = `
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.content,
        m.message_type,
        m.file_url,
        m.file_name,
        m.file_size,
        COALESCE(m.reactions, '{}'::jsonb) AS reactions,
        COALESCE(m.is_starred, false) AS is_starred,
        m.created_at,
        u.name AS sender_name,
        u.phone AS sender_phone,
        u.avatar_url AS sender_avatar
      FROM chat.messages m
      JOIN chat.users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT 250;
    `;

    const messagesRes = await pool.query(messagesQuery, [id]);
    res.status(200).json({ messages: messagesRes.rows });
  } catch (error: any) {
    console.error("GetMessages Error:", error);
    res.status(500).json({ error: "Failed to fetch messages.", detail: error.message });
  }
}

// ==========================================================
// 8. Delete Single Message
// ==========================================================
export async function deleteMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;
    const { id: conversationId, messageId } = req.params;

    const deleteRes = await pool.query(
      `DELETE FROM chat.messages 
       WHERE id = $1 AND conversation_id = $2 AND sender_id = $3
       RETURNING id, conversation_id`,
      [messageId, conversationId, currentUserId]
    );

    if (deleteRes.rows.length === 0) {
      res.status(403).json({ error: "You can only delete your own messages." });
      return;
    }

    res.status(200).json({ success: true, messageId, conversationId });
  } catch (error: any) {
    console.error("DeleteMessage Error:", error);
    res.status(500).json({ error: "Failed to delete message.", detail: error.message });
  }
}

// ==========================================================
// 9. Clear All Messages in Conversation
// ==========================================================
export async function clearConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;
    const { id: conversationId } = req.params;

    const memberCheck = await pool.query(
      "SELECT 1 FROM chat.conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, currentUserId]
    );

    if (memberCheck.rows.length === 0) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    await pool.query(
      "DELETE FROM chat.messages WHERE conversation_id = $1",
      [conversationId]
    );

    res.status(200).json({ success: true, conversationId });
  } catch (error: any) {
    console.error("ClearConversation Error:", error);
    res.status(500).json({ error: "Failed to clear chat.", detail: error.message });
  }
}

// ==========================================================
// 10. Star / Bookmark Message
// ==========================================================
export async function toggleStarMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id: conversationId, messageId } = req.params;

    const msgCheck = await pool.query(
      "SELECT is_starred FROM chat.messages WHERE id = $1 AND conversation_id = $2",
      [messageId, conversationId]
    );

    if (msgCheck.rows.length === 0) {
      res.status(404).json({ error: "Message not found." });
      return;
    }

    const newStarStatus = !msgCheck.rows[0].is_starred;
    await pool.query(
      "UPDATE chat.messages SET is_starred = $1 WHERE id = $2",
      [newStarStatus, messageId]
    );

    res.status(200).json({ success: true, messageId, conversationId, is_starred: newStarStatus });
  } catch (error: any) {
    console.error("ToggleStarMessage Error:", error);
    res.status(500).json({ error: "Failed to toggle star.", detail: error.message });
  }
}
