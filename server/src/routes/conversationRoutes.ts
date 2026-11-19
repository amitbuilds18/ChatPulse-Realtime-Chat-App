import { Router } from "express";
import {
  getOrCreateConversation,
  createRoom,
  getPublicRooms,
  joinRoom,
  getConversations,
  getConversationById,
  getMessages,
  deleteMessage,
  clearConversation,
  toggleStarMessage
} from "../controllers/conversationController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.use(protect); // All conversation routes require JWT authentication

// Group Chat Rooms
router.post("/rooms", createRoom);
router.get("/rooms/public", getPublicRooms);
router.post("/rooms/:id/join", joinRoom);

// Direct Conversations & Message Endpoints
router.post("/", getOrCreateConversation);
router.get("/", getConversations);
router.get("/:id", getConversationById);
router.get("/:id/messages", getMessages);
router.delete("/:id/messages/:messageId", deleteMessage);
router.delete("/:id/messages", clearConversation);
router.patch("/:id/messages/:messageId/star", toggleStarMessage);

export default router;
