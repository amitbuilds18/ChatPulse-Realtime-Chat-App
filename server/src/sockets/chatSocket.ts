import { Server, Socket } from "socket.io";
import { verifyToken, TokenPayload } from "../utils/jwt";
import pool from "../config/db";
import { sendRealSMSOrWhatsApp } from "../services/smsService";

// Map: userId -> Set of active socket IDs
const onlineUsers = new Map<string, Set<string>>();

export function setupSocketIO(io: Server): void {
  // 1. Socket Authentication Middleware
  io.use((socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("Authentication failed: No token provided"));
      }

      const decoded = verifyToken(token);
      socket.data.user = decoded;
      next();
    } catch (err: any) {
      console.error("Socket Auth Error:", err.message);
      next(new Error("Authentication failed: Invalid token"));
    }
  });

  // 2. Connection Event Handler
  io.on("connection", (socket: Socket) => {
    const user = socket.data.user as TokenPayload;
    const userId = user.id;

    console.log(`⚡ [Socket.IO] User connected: ${user.name} (${userId}) on socket ${socket.id}`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)?.add(socket.id);

    // Broadcast user is online
    io.emit("presence:update", {
      userId,
      status: "online",
      onlineUsers: Array.from(onlineUsers.keys())
    });

    // Send initial list of online users to the newly connected client
    socket.emit("presence:init", {
      onlineUsers: Array.from(onlineUsers.keys())
    });

    // Join personal user room for direct notifications
    socket.join(`user_${userId}`);

    // ==========================================================
    // Event: conversation:join
    // ==========================================================
    socket.on("conversation:join", async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          if (callback) callback({ error: "conversationId is required" });
          return;
        }

        // Verify membership in database
        const memberCheck = await pool.query(
          "SELECT 1 FROM chat.conversation_members WHERE conversation_id = $1 AND user_id = $2",
          [conversationId, userId]
        );

        if (memberCheck.rows.length === 0) {
          if (callback) callback({ error: "Access denied. Not a member of this conversation." });
          return;
        }

        socket.join(`conv_${conversationId}`);
        console.log(`👥 [Socket.IO] User ${user.name} joined room conv_${conversationId}`);

        if (callback) callback({ success: true, conversationId });
      } catch (err: any) {
        console.error("conversation:join Error:", err.message);
        if (callback) callback({ error: "Failed to join conversation room" });
      }
    });

    // ==========================================================
    // Event: message:send (Supports Text & Multimedia Images/Files)
    // ==========================================================
    socket.on("message:send", async (data, callback) => {
      try {
        const { conversationId, content, messageType = "text", fileUrl, fileName, fileSize } = data;
        const cleanContent = (content || "").trim();

        if (!conversationId || (!cleanContent && !fileUrl)) {
          if (callback) callback({ error: "conversationId and either content or file are required." });
          return;
        }

        // Verify conversation membership
        const memberCheck = await pool.query(
          "SELECT 1 FROM chat.conversation_members WHERE conversation_id = $1 AND user_id = $2",
          [conversationId, userId]
        );

        if (memberCheck.rows.length === 0) {
          if (callback) callback({ error: "Unauthorized: You are not a member of this conversation." });
          return;
        }

        // Save message to Neon PostgreSQL
        const insertRes = await pool.query(
          `INSERT INTO chat.messages (conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, conversation_id, sender_id, content, message_type, file_url, file_name, file_size, created_at`,
          [conversationId, userId, cleanContent, messageType || "text", fileUrl || null, fileName || null, fileSize || null]
        );

        const savedMessage = insertRes.rows[0];

        // Fetch sender details
        const senderRes = await pool.query(
          "SELECT name, avatar_url FROM chat.users WHERE id = $1",
          [userId]
        );
        const sender = senderRes.rows[0];

        const messagePayload = {
          ...savedMessage,
          sender_name: sender.name,
          sender_avatar: sender.avatar_url
        };

        // Broadcast to all sockets in conversation room
        io.to(`conv_${conversationId}`).emit("message:new", messagePayload);

        // Also notify other participants and trigger Real SMS/WhatsApp dispatch if direct chat
        const otherMembersRes = await pool.query(
          `SELECT cm.user_id, u.name, u.phone, c.type AS conv_type
           FROM chat.conversation_members cm
           JOIN chat.users u ON cm.user_id = u.id
           JOIN chat.conversations c ON cm.conversation_id = c.id
           WHERE cm.conversation_id = $1 AND cm.user_id != $2`,
          [conversationId, userId]
        );

        otherMembersRes.rows.forEach(m => {
          io.to(`user_${m.user_id}`).emit("conversation:updated", {
            conversationId,
            last_message: messagePayload
          });

          // If direct chat and recipient has a phone, dispatch real SMS / WhatsApp gateway
          if (m.conv_type === "direct" && m.phone) {
            const smsText = cleanContent || (messageType === "image" ? "[Photo Attachment]" : "[File Attachment]");
            sendRealSMSOrWhatsApp({
              toPhone: m.phone,
              senderName: sender.name,
              messageContent: smsText
            }).catch(e => console.warn("SMS dispatch error:", e.message));
          }
        });

        if (callback) callback({ success: true, message: messagePayload });
      } catch (err: any) {
        console.error("message:send Error:", err.message);
        if (callback) callback({ error: "Failed to send message", detail: err.message });
      }
    });

    // ==========================================================
    // Event: typing:start & typing:stop
    // ==========================================================
    socket.on("typing:start", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit("typing:update", {
        conversationId,
        userId,
        userName: user.name,
        isTyping: true
      });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit("typing:update", {
        conversationId,
        userId,
        userName: user.name,
        isTyping: false
      });
    });

    // ==========================================================
    // Event: message:delete
    // ==========================================================
    socket.on("message:delete", async ({ conversationId, messageId }, callback) => {
      try {
        if (!conversationId || !messageId) return;

        const deleteRes = await pool.query(
          "DELETE FROM chat.messages WHERE id = $1 AND conversation_id = $2 AND sender_id = $3 RETURNING id",
          [messageId, conversationId, userId]
        );

        if (deleteRes.rows.length > 0) {
          io.to(`conv_${conversationId}`).emit("message:deleted", { conversationId, messageId });
          if (callback) callback({ success: true, messageId });
        } else {
          if (callback) callback({ error: "Cannot delete this message." });
        }
      } catch (err: any) {
        console.error("message:delete Error:", err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // ==========================================================
    // Event: conversation:clear
    // ==========================================================
    socket.on("conversation:clear", async ({ conversationId }, callback) => {
      try {
        if (!conversationId) return;

        await pool.query("DELETE FROM chat.messages WHERE conversation_id = $1", [conversationId]);
        io.to(`conv_${conversationId}`).emit("conversation:cleared", { conversationId });
        if (callback) callback({ success: true });
      } catch (err: any) {
        console.error("conversation:clear Error:", err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // ==========================================================
    // Event: message:react (Emoji Reactions)
    // ==========================================================
    socket.on("message:react", async ({ conversationId, messageId, emoji }, callback) => {
      try {
        if (!conversationId || !messageId || !emoji) return;

        const msgRes = await pool.query(
          "SELECT reactions FROM chat.messages WHERE id = $1 AND conversation_id = $2",
          [messageId, conversationId]
        );

        if (msgRes.rows.length === 0) return;

        let reactions = msgRes.rows[0].reactions || {};
        if (typeof reactions !== "object" || Array.isArray(reactions)) reactions = {};

        const userList = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
        const existingIdx = userList.indexOf(userId);

        if (existingIdx > -1) {
          userList.splice(existingIdx, 1);
        } else {
          userList.push(userId);
        }

        if (userList.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = userList;
        }

        await pool.query(
          "UPDATE chat.messages SET reactions = $1 WHERE id = $2",
          [JSON.stringify(reactions), messageId]
        );

        io.to(`conv_${conversationId}`).emit("message:reaction_updated", {
          conversationId,
          messageId,
          reactions
        });

        if (callback) callback({ success: true, reactions });
      } catch (err: any) {
        console.error("message:react Error:", err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // ==========================================================
    // Event: message:star_toggle
    // ==========================================================
    socket.on("message:star_toggle", async ({ conversationId, messageId }, callback) => {
      try {
        if (!conversationId || !messageId) return;

        const checkRes = await pool.query(
          "SELECT is_starred FROM chat.messages WHERE id = $1 AND conversation_id = $2",
          [messageId, conversationId]
        );

        if (checkRes.rows.length === 0) return;

        const newStatus = !checkRes.rows[0].is_starred;
        await pool.query(
          "UPDATE chat.messages SET is_starred = $1 WHERE id = $2",
          [newStatus, messageId]
        );

        io.to(`conv_${conversationId}`).emit("message:starred", {
          conversationId,
          messageId,
          is_starred: newStatus
        });

        if (callback) callback({ success: true, is_starred: newStatus });
      } catch (err: any) {
        console.error("message:star_toggle Error:", err.message);
        if (callback) callback({ error: err.message });
      }
    });

    // ==========================================================
    // Event: disconnect
    // ==========================================================
    socket.on("disconnect", () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast that user went offline
          io.emit("presence:update", {
            userId,
            status: "offline",
            onlineUsers: Array.from(onlineUsers.keys())
          });
        }
      }
      console.log(`🔌 [Socket.IO] User disconnected: ${user.name} (${userId})`);
    });
  });
}
