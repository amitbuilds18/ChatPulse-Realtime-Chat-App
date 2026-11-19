import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Search,
  Send,
  LogOut,
  Users,
  CheckCheck,
  Phone,
  UserPlus,
  ArrowLeft,
  Zap,
  Clock,
  X,
  PhoneCall,
  Smartphone,
  Image,
  Smile,
  Bell,
  BellOff,
  Hash,
  PlusCircle,
  Maximize2,
  Trash2,
  Mic,
  Square,
  Download,
  Heart,
  Star,
  Settings,
  Edit3
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../services/api";
import { playNotificationSound } from "../utils/sound";

export default function ChatDashboard() {
  const { user, updateUserPhone, updateUserProfile, sendOtpToPhone, verifyPhoneOtp, logout } = useAuth();
  const { socket, onlineUsers, typingMap } = useSocket();

  // Navigation & Data States
  const [conversations, setConversations] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "rooms" | "contacts"
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // In-Chat Search State
  const [inChatSearch, setInChatSearch] = useState("");
  const [showInChatSearch, setShowInChatSearch] = useState(false);

  // Unread Count Tracking & Notification sound
  const [unreadMap, setUnreadMap] = useState({});
  const [notificationsAllowed, setNotificationsAllowed] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );

  // Multimedia Image Attachment States
  const [selectedImage, setSelectedImage] = useState(null); // { dataUrl, name, size }
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const fileInputRef = useRef(null);

  // Emoji Picker State
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const quickEmojis = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "🚀", "👏", "🙏", "💯", "😍", "✨"];

  // Voice Note Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Message Reactions States
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
  const reactionEmojis = ["❤️", "👍", "😂", "🔥", "🎉", "😮"];

  // Modals
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [phoneModalLoading, setPhoneModalLoading] = useState(false);
  const [phoneModalError, setPhoneModalError] = useState("");

  // Create Room Modal
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [roomTitleInput, setRoomTitleInput] = useState("");
  const [roomDescInput, setRoomDescInput] = useState("");
  const [createRoomLoading, setCreateRoomLoading] = useState(false);
  const [createRoomError, setCreateRoomError] = useState("");

  // Link Phone Modal
  const [showMyPhoneModal, setShowMyPhoneModal] = useState(false);
  const [myPhoneInput, setMyPhoneInput] = useState(user?.phone || "");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [myPhoneLoading, setMyPhoneLoading] = useState(false);
  const [myPhoneError, setMyPhoneError] = useState("");
  const [myPhoneSuccess, setMyPhoneSuccess] = useState("");

  // Profile Settings Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState(user?.name || "");
  const [profileStatusInput, setProfileStatusInput] = useState(user?.status_text || "Hey there! I am using ChatPulse.");
  const [profileAvatarInput, setProfileAvatarInput] = useState(user?.avatar_url || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    if (user) {
      if (user.name) setProfileNameInput(user.name);
      if (user.status_text) setProfileStatusInput(user.status_text);
      if (user.avatar_url) setProfileAvatarInput(user.avatar_url);
    }
  }, [user]);

  // Starred Messages Filter State
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Request Desktop Notification Permission
  const requestNotificationPermission = async () => {
    if (typeof Notification !== "undefined") {
      const perm = await Notification.requestPermission();
      setNotificationsAllowed(perm === "granted");
    }
  };

  // 1. Fetch conversations & rooms
  const loadConversations = async () => {
    try {
      const res = await api.get("/conversations");
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error("Failed to load conversations:", err.message);
    }
  };

  const loadPublicRooms = async () => {
    try {
      const res = await api.get("/conversations/rooms/public");
      setPublicRooms(res.data.rooms || []);
    } catch (err) {
      console.error("Failed to load public rooms:", err.message);
    }
  };

  const loadAllUsers = async (query = "") => {
    try {
      const res = await api.get(`/users${query ? `?search=${encodeURIComponent(query)}` : ""}`);
      setAllUsers(res.data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err.message);
    }
  };

  useEffect(() => {
    loadConversations();
    loadPublicRooms();
    loadAllUsers();
  }, []);

  // 2. Search query debounce
  useEffect(() => {
    if (activeTab === "contacts") {
      const timer = setTimeout(() => {
        loadAllUsers(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeTab]);

  // 3. Select Conversation / Room
  const handleSelectConversation = async (conv) => {
    setActiveConversation(conv);
    setShowMobileChat(true);
    // Clear unread badge for this conversation
    setUnreadMap((prev) => ({ ...prev, [conv.id]: 0 }));
    await loadMessages(conv.id);
  };

  const handleSelectUser = async (targetUser) => {
    try {
      const res = await api.post("/conversations", { recipientId: targetUser.id });
      const conv = res.data.conversation;
      setActiveConversation(conv);
      setShowMobileChat(true);
      setUnreadMap((prev) => ({ ...prev, [conv.id]: 0 }));
      await loadMessages(conv.id);
      loadConversations();
    } catch (err) {
      console.error("Error creating conversation:", err.message);
    }
  };

  // 4. Create Group Room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomTitleInput.trim()) return;

    setCreateRoomLoading(true);
    setCreateRoomError("");

    try {
      const res = await api.post("/conversations/rooms", {
        title: roomTitleInput.trim(),
        description: roomDescInput.trim(),
        isPublic: true
      });
      const newRoom = res.data.conversation;
      setShowCreateRoomModal(false);
      setRoomTitleInput("");
      setRoomDescInput("");
      await loadConversations();
      await loadPublicRooms();
      handleSelectConversation(newRoom);
    } catch (err) {
      setCreateRoomError(err.response?.data?.error || err.message || "Failed to create room.");
    } finally {
      setCreateRoomLoading(false);
    }
  };

  // 5. Join Public Room
  const handleJoinRoom = async (room) => {
    try {
      const res = await api.post(`/conversations/rooms/${room.id}/join`);
      const joinedConv = res.data.conversation;
      await loadConversations();
      await loadPublicRooms();
      handleSelectConversation(joinedConv);
    } catch (err) {
      console.error("Error joining room:", err.message);
    }
  };

  // 6. Start chat by Phone Number
  const handleStartChatByPhone = async (e) => {
    e.preventDefault();
    if (!contactPhoneInput.trim()) return;

    setPhoneModalLoading(true);
    setPhoneModalError("");

    try {
      const userRes = await api.post("/users/by-phone", { phone: contactPhoneInput.trim() });
      const targetUser = userRes.data.user;

      if (targetUser.id === user.id) {
        throw new Error("You cannot start a chat with your own account.");
      }

      await handleSelectUser(targetUser);
      setShowPhoneModal(false);
      setContactPhoneInput("");
      loadConversations();
      loadAllUsers();
    } catch (err) {
      if (err.response?.status === 404 && err.response?.data?.error === "Route not found") {
        setPhoneModalError("Backend server is restarting. Please check port 5001.");
      } else {
        setPhoneModalError(err.response?.data?.error || err.message || "Failed to connect to this number.");
      }
    } finally {
      setPhoneModalLoading(false);
    }
  };

  // 7. Phone OTP Link
  const handleRequestOtp = async () => {
    if (!myPhoneInput.trim()) {
      setMyPhoneError("Please enter your phone number first.");
      return;
    }

    setMyPhoneLoading(true);
    setMyPhoneError("");
    setMyPhoneSuccess("");

    try {
      const formattedPhone = myPhoneInput.trim();
      const savedUser = await updateUserPhone(formattedPhone);
      await sendOtpToPhone(savedUser.phone || formattedPhone);
      setOtpSent(true);
      setMyPhoneSuccess("OTP sent to your mobile number. Please enter it below.");
    } catch (err) {
      setMyPhoneError(err.response?.data?.error || err.message || "Failed to send OTP.");
    } finally {
      setMyPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setMyPhoneError("Please enter the OTP.");
      return;
    }

    setMyPhoneLoading(true);
    setMyPhoneError("");
    setMyPhoneSuccess("");

    try {
      await verifyPhoneOtp(myPhoneInput.trim(), otpCode.trim());
      setMyPhoneSuccess("Your mobile number has been verified successfully!");
      setOtpSent(false);
      setOtpCode("");
      setTimeout(() => {
        setShowMyPhoneModal(false);
        setMyPhoneSuccess("");
      }, 1200);
    } catch (err) {
      setMyPhoneError(err.response?.data?.error || err.message || "OTP verification failed.");
    } finally {
      setMyPhoneLoading(false);
    }
  };

  // 8. Load message history
  const loadMessages = async (convId) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/conversations/${convId}/messages`);
      setMessages(res.data.messages || []);
      if (socket) {
        socket.emit("conversation:join", { conversationId: convId });
      }
    } catch (err) {
      console.error("Failed to load messages:", err.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 9. Socket Listeners with Notification Audio & Badges
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg) => {
      // If message is in the currently opened conversation
      if (activeConversation && newMsg.conversation_id === activeConversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      } else {
        // Increment unread count for other conversation
        setUnreadMap((prev) => ({
          ...prev,
          [newMsg.conversation_id]: (prev[newMsg.conversation_id] || 0) + 1
        }));
      }

      // Play audio notification chime for incoming message from other user
      if (newMsg.sender_id !== user?.id) {
        playNotificationSound();

        // Browser desktop notification if tab is hidden
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          const title = newMsg.sender_name || "New Message on ChatPulse";
          const body = newMsg.message_type === "image" ? "📷 Sent an image attachment" : newMsg.content;
          try {
            new Notification(title, { body, icon: newMsg.sender_avatar });
          } catch (e) {
            console.debug("Notification error:", e);
          }
        }
      }

      loadConversations();
    };

    const handleConversationUpdated = () => {
      loadConversations();
    };

    const handleMessageDeleted = ({ conversationId, messageId }) => {
      if (activeConversation && conversationId === activeConversation.id) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      loadConversations();
    };

    const handleConversationCleared = ({ conversationId }) => {
      if (activeConversation && conversationId === activeConversation.id) {
        setMessages([]);
      }
      loadConversations();
    };

    const handleReactionUpdated = ({ conversationId, messageId, reactions }) => {
      if (activeConversation && conversationId === activeConversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
        );
      }
    };

    const handleMessageStarred = ({ conversationId, messageId, is_starred }) => {
      if (activeConversation && conversationId === activeConversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_starred } : m))
        );
      }
    };

    socket.on("message:new", handleNewMessage);
    socket.on("conversation:updated", handleConversationUpdated);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("conversation:cleared", handleConversationCleared);
    socket.on("message:reaction_updated", handleReactionUpdated);
    socket.on("message:starred", handleMessageStarred);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("conversation:updated", handleConversationUpdated);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("conversation:cleared", handleConversationCleared);
      socket.off("message:reaction_updated", handleReactionUpdated);
      socket.off("message:starred", handleMessageStarred);
    };
  }, [socket, activeConversation, user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing Indicators
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activeConversation) return;

    socket.emit("typing:start", { conversationId: activeConversation.id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId: activeConversation.id });
    }, 1500);
  };

  // 10. Multimedia Image Selection Handler
  const handleImageFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (JPEG, PNG, GIF, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is larger than 5MB. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage({
        dataUrl: reader.result,
        name: file.name,
        size: file.size
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // reset file input
  };

  // 11. Send message (Supports Text, Images, and Emojis)
  const handleSendMessage = (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !activeConversation || !socket) return;

    const content = inputText.trim();
    const imagePayload = selectedImage;

    setInputText("");
    setSelectedImage(null);
    setShowEmojiBar(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit("typing:stop", { conversationId: activeConversation.id });

    socket.emit(
      "message:send",
      {
        conversationId: activeConversation.id,
        content: content,
        messageType: imagePayload ? "image" : "text",
        fileUrl: imagePayload?.dataUrl || null,
        fileName: imagePayload?.name || null,
        fileSize: imagePayload?.size || null
      },
      (response) => {
        if (response?.error) {
          console.error("Send error:", response.error);
        }
      }
    );
  };

  // 12. Delete message in real-time
  const handleDeleteMessage = (messageId) => {
    if (!socket || !activeConversation) return;
    if (!window.confirm("Delete this message?")) return;

    socket.emit(
      "message:delete",
      {
        conversationId: activeConversation.id,
        messageId
      },
      (res) => {
        if (res?.error) {
          alert(res.error);
        }
      }
    );
  };

  // 13. Clear all messages in active conversation
  const handleClearChat = () => {
    if (!socket || !activeConversation) return;
    if (!window.confirm("Are you sure you want to clear all messages in this conversation?")) return;

    socket.emit(
      "conversation:clear",
      {
        conversationId: activeConversation.id
      },
      (res) => {
        if (res?.error) {
          alert(res.error);
        }
      }
    );
  };

  // 14. Voice Audio Note Recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone permission denied or audio device not found.");
    }
  };

  const stopAndSendVoiceRecording = () => {
    if (!mediaRecorderRef.current) return;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = () => {
      clearInterval(recordingTimerRef.current);
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = () => {
        const base64Audio = reader.result;
        socket.emit("message:send", {
          conversationId: activeConversation.id,
          content: `🎙️ Voice Note (${recordingDuration}s)`,
          messageType: "audio",
          fileUrl: base64Audio,
          fileName: `voice_${Date.now()}.webm`,
          fileSize: audioBlob.size
        });
      };
      reader.readAsDataURL(audioBlob);

      recorder.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      setRecordingDuration(0);
    };

    recorder.stop();
  };

  const cancelVoiceRecording = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
    setRecordingDuration(0);
  };

  // 15. Export Chat Transcript (.txt)
  const handleExportChat = () => {
    if (!activeConversation || messages.length === 0) {
      alert("No messages to export yet.");
      return;
    }
    const title = activeConversation.type === "group" ? activeConversation.title : activeConversation.participant?.name;
    let text = `====================================================\n`;
    text += `ChatPulse Transcript: ${title}\n`;
    text += `Exported At: ${new Date().toLocaleString()}\n`;
    text += `Total Messages: ${messages.length}\n`;
    text += `====================================================\n\n`;

    messages.forEach((m) => {
      const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const sender = m.sender_id === user.id ? "Me" : (m.sender_name || "Contact");
      const content = m.message_type === "image" ? `[Photo: ${m.file_name || "image"}] ${m.content || ""}` : m.message_type === "audio" ? `[Voice Audio Note] ${m.content || ""}` : m.content;
      text += `[${time}] ${sender}: ${content}\n`;
    });

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chatpulse_${title.replace(/[^a-zA-Z0-9]/g, "_")}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 16. Message Emoji Reactions
  const handleReact = (messageId, emoji) => {
    if (!socket || !activeConversation) return;
    socket.emit("message:react", {
      conversationId: activeConversation.id,
      messageId,
      emoji
    });
  };

  // 17. Toggle Star on a message
  const handleToggleStar = (messageId) => {
    if (!socket || !activeConversation) return;
    socket.emit("message:star_toggle", {
      conversationId: activeConversation.id,
      messageId
    });
  };

  // 18. Save User Profile Settings (Name, Avatar, Status)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      await updateUserProfile({
        name: profileNameInput.trim(),
        avatar_url: profileAvatarInput.trim(),
        status_text: profileStatusInput.trim()
      });
      setProfileSuccess("Profile updated successfully!");
      loadConversations();
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileSuccess("");
      }, 700);
    } catch (err) {
      setProfileError(err.response?.data?.error || err.message || "Failed to update profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Filter conversations
  const directChats = conversations.filter((c) => c.type === "direct");
  const groupRooms = conversations.filter((c) => c.type === "group");

  const isPartnerOnline = activeConversation?.participant
    ? onlineUsers.has(activeConversation.participant.id)
    : false;

  const isPartnerTyping = activeConversation ? typingMap[activeConversation.id] : null;

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ========================================================= */}
      {/* MODAL: Fullscreen Image Zoom Preview                      */}
      {/* ========================================================= */}
      {previewModalImage && (
        <div
          onClick={() => setPreviewModalImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setPreviewModalImage(null)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewModalImage}
              alt="Zoom Preview"
              className="rounded-2xl max-h-[85vh] max-w-full object-contain shadow-2xl border border-slate-800"
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Create New Group Chat Room                         */}
      {/* ========================================================= */}
      {showCreateRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => {
                setShowCreateRoomModal(false);
                setCreateRoomError("");
              }}
              className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create Group Chat Room</h3>
                <p className="text-xs text-slate-400">Collaborate with multiple users in one room</p>
              </div>
            </div>

            {createRoomError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span>{createRoomError}</span>
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Title / Name
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-violet-400 shrink-0">
                    #
                  </span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={roomTitleInput}
                    onChange={(e) => setRoomTitleInput(e.target.value)}
                    placeholder="e.g. CodeCraft Interns Hub"
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Description (Optional)
                </label>
                <input
                  type="text"
                  value={roomDescInput}
                  onChange={(e) => setRoomDescInput(e.target.value)}
                  placeholder="e.g. Discussion room for task updates & code review"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateRoomModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRoomLoading || !roomTitleInput.trim()}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white shadow-lg shadow-violet-600/30 transition cursor-pointer"
                >
                  {createRoomLoading ? "Creating..." : "Create Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Link Real Phone Number                             */}
      {/* ========================================================= */}
      {showMyPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => {
                setShowMyPhoneModal(false);
                setMyPhoneError("");
              }}
              className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Link Real Mobile Number</h3>
                <p className="text-xs text-slate-400">Receive real SMS & allow contacts to message you</p>
              </div>
            </div>

            {myPhoneError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span>{myPhoneError}</span>
              </div>
            )}

            {myPhoneSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{myPhoneSuccess}</span>
              </div>
            )}

            {!otpSent ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRequestOtp();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Your Indian Mobile Number
                  </label>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-400 shrink-0">
                      🇮🇳 +91
                    </span>
                    <input
                      type="tel"
                      required
                      autoFocus
                      value={myPhoneInput}
                      onChange={(e) => setMyPhoneInput(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMyPhoneModal(false);
                      setOtpCode("");
                      setOtpSent(false);
                      setMyPhoneError("");
                    }}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={myPhoneLoading || !myPhoneInput.trim()}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                  >
                    {myPhoneLoading ? "Sending..." : "Send OTP"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Enter OTP sent to {myPhoneInput}
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit OTP"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition font-mono tracking-[0.4em] text-center"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                      setMyPhoneError("");
                    }}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={myPhoneLoading || otpCode.length !== 6}
                    className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                  >
                    {myPhoneLoading ? "Verifying..." : "Verify OTP"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Start Chat by Phone Number                         */}
      {/* ========================================================= */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => {
                setShowPhoneModal(false);
                setPhoneModalError("");
              }}
              className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Message by Real Mobile Number</h3>
                <p className="text-xs text-slate-400">Open instant chat with any Indian mobile number</p>
              </div>
            </div>

            {phoneModalError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span>{phoneModalError}</span>
              </div>
            )}

            <form onSubmit={handleStartChatByPhone} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Enter Recipient Contact Number
                </label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 shrink-0">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    required
                    autoFocus
                    value={contactPhoneInput}
                    onChange={(e) => setContactPhoneInput(e.target.value)}
                    placeholder="Enter any 10-digit number (e.g. 9876543210)"
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  ✨ Enter any real phone number. A direct chat will open, and every message sent will dispatch via SMS/WhatsApp gateway.
                </p>
              </div>

              {/* Sample Chips */}
              <div className="pt-1">
                <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Quick Demo Contacts:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setContactPhoneInput("9876543210")}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 cursor-pointer"
                  >
                    Amit: 9876543210
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactPhoneInput("9123456789")}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 border border-slate-700 cursor-pointer"
                  >
                    Rahul: 9123456789
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactPhoneInput("9988776655")}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 cursor-pointer"
                  >
                    Priya: 9988776655
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhoneModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={phoneModalLoading || !contactPhoneInput.trim()}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                >
                  {phoneModalLoading ? "Connecting..." : "Open Chat Window"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Profile & Presence Status Settings                 */}
      {/* ========================================================= */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => {
                setShowProfileModal(false);
                setProfileError("");
                setProfileSuccess("");
              }}
              className="absolute right-5 top-5 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Profile & Status Settings</h3>
                <p className="text-xs text-slate-400">Personalize your avatar, name, and live status</p>
              </div>
            </div>

            {profileError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Profile Picture / Avatar
                </label>
                <div className="flex items-center gap-3.5 mb-2 p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <img
                    src={profileAvatarInput || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email}`}
                    alt="Current Avatar"
                    className="w-12 h-12 rounded-2xl bg-slate-800 object-cover border-2 border-indigo-500/60 p-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-[11px] text-slate-400 font-medium block mb-1.5">
                      Select an Avatar Preset:
                    </span>
                    <div className="flex gap-2">
                      {[
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id || "Alpha"}`,
                        "https://api.dicebear.com/7.x/bottts/svg?seed=Felix",
                        "https://api.dicebear.com/7.x/bottts/svg?seed=Bella",
                        "https://api.dicebear.com/7.x/bottts/svg?seed=Jack",
                        "https://api.dicebear.com/7.x/bottts/svg?seed=Luna"
                      ].map((presetUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setProfileAvatarInput(presetUrl)}
                          className={`w-8 h-8 rounded-xl overflow-hidden border transition cursor-pointer ${
                            profileAvatarInput === presetUrl
                              ? "border-indigo-400 ring-2 ring-indigo-500/50"
                              : "border-slate-800 hover:border-slate-600 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img src={presetUrl} alt="Preset" className="w-full h-full bg-slate-800" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Display Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                />
              </div>

              {/* Status Text (WhatsApp Style) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  About & Status (Visible to other users)
                </label>
                <input
                  type="text"
                  value={profileStatusInput}
                  onChange={(e) => setProfileStatusInput(e.target.value)}
                  placeholder="e.g. 🟢 Available, 💻 Coding, ⚡ In a meeting..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
                />

                {/* Status Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {[
                    "🟢 Available",
                    "💻 Coding...",
                    "⚡ In a meeting",
                    "⛔ Busy",
                    "🚀 Building apps",
                    "💬 Hey there! I am using ChatPulse."
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setProfileStatusInput(chip)}
                      className={`text-[10px] px-2 py-1 rounded-lg border transition cursor-pointer ${
                        profileStatusInput === chip
                          ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 font-semibold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileLoading || !profileNameInput.trim()}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {profileLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LEFT SIDEBAR: Conversations, Rooms & Contacts             */}
      {/* ========================================================= */}
      <aside
        className={`${
          showMobileChat ? "hidden md:flex" : "flex"
        } w-full md:w-80 lg:w-96 flex-col border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl shrink-0`}
      >
        {/* User Profile Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={user?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email}`}
                alt={user?.name}
                className="w-10 h-10 rounded-full bg-slate-800 object-cover border border-slate-700"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                {user?.name}
              </h2>
              <p className="text-[11px] text-slate-400 truncate font-mono">{user?.email}</p>
              <p className="text-[10px] text-indigo-300/80 truncate italic">"{user?.status_text || "Hey there! I am using ChatPulse."}"</p>
              {user?.phone ? (
                <button
                  onClick={() => setShowMyPhoneModal(true)}
                  className="text-[10px] text-emerald-400 hover:underline font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-2.5 h-2.5" />
                  <span>{user.phone}</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowMyPhoneModal(true)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <span>+ Link Phone Number</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowProfileModal(true)}
              title="Profile & Status Settings"
              className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-slate-800 transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={requestNotificationPermission}
              title={notificationsAllowed ? "Notifications active" : "Enable desktop notifications"}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                notificationsAllowed
                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                  : "text-slate-400 hover:text-amber-400 border-slate-800"
              }`}
            >
              {notificationsAllowed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowPhoneModal(true)}
              title="Message a Phone Number"
              className="p-2 rounded-xl text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              title="Log Out"
              className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real Mobile Number Banner */}
        {!user?.phone ? (
          <div className="mx-3 my-2.5 p-2.5 rounded-xl bg-gradient-to-r from-indigo-500/15 to-violet-500/15 border border-indigo-500/25 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-white">Add Your Real Mobile Number</p>
                <p className="text-[10px] text-slate-400">Receive real SMS & lets friends find you</p>
              </div>
            </div>
            <button
              onClick={() => setShowMyPhoneModal(true)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-sm shadow-indigo-600/30 transition cursor-pointer shrink-0"
            >
              + Add
            </button>
          </div>
        ) : (
          <div className="mx-3 my-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-mono text-emerald-300">Mobile: {user.phone}</span>
            </div>
            <button
              onClick={() => setShowMyPhoneModal(true)}
              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
            >
              Edit
            </button>
          </div>
        )}

        {/* Action Button: New Message to Number */}
        <div className="p-3 border-b border-slate-800/80 bg-emerald-950/20">
          <button
            onClick={() => setShowPhoneModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 transition cursor-pointer"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Message a Contact Number</span>
          </button>
        </div>

        {/* Tab Controls: Chats vs Rooms vs Contacts */}
        <div className="p-3 border-b border-slate-800/80">
          <div className="flex p-1 bg-slate-950/70 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab("chats")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "chats"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Direct ({directChats.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("rooms")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "rooms"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Rooms ({groupRooms.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("contacts")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                activeTab === "contacts"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Contacts</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="mt-2.5 relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "chats"
                  ? "Search direct chats..."
                  : activeTab === "rooms"
                  ? "Search group rooms..."
                  : "Search contacts by name, phone..."
              }
              className="w-full bg-slate-950/80 border border-slate-800/80 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition"
            />
          </div>
        </div>

        {/* Tab Content List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {/* TAB 1: Direct 1-on-1 Chats */}
          {activeTab === "chats" && (
            directChats.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                <p className="font-semibold text-slate-300">No direct chats yet</p>
                <p className="text-[11px] mt-1 text-slate-400 mb-3">
                  Click "Message a Contact Number" or select from Contacts!
                </p>
              </div>
            ) : (
              directChats
                .filter((c) => {
                  const q = searchQuery.toLowerCase();
                  return (
                    c.participant?.name?.toLowerCase().includes(q) ||
                    c.participant?.phone?.toLowerCase().includes(q) ||
                    c.participant?.email?.toLowerCase().includes(q)
                  );
                })
                .map((conv) => {
                  const isOnline = conv.participant ? onlineUsers.has(conv.participant.id) : false;
                  const isSelected = activeConversation?.id === conv.id;
                  const isTyping = typingMap[conv.id];
                  const unreadCount = unreadMap[conv.id] || 0;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`p-3.5 flex items-center gap-3 cursor-pointer transition ${
                        isSelected
                          ? "bg-indigo-950/40 border-l-4 border-indigo-500"
                          : "hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={conv.avatar_url}
                          alt={conv.participant?.name}
                          className="w-11 h-11 rounded-full bg-slate-800 object-cover border border-slate-700/80"
                        />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="text-xs font-semibold text-white truncate">
                            {conv.participant?.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatTime(conv.last_message?.created_at || conv.created_at)}
                          </span>
                        </div>

                        {conv.participant?.phone && (
                          <div className="text-[10px] text-emerald-400/90 font-mono flex items-center gap-1 mb-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{conv.participant.phone}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 flex-1">
                            {isTyping ? (
                              <span className="text-indigo-400 font-medium italic animate-pulse">
                                typing...
                              </span>
                            ) : conv.last_message ? (
                              <>
                                {conv.last_message.sender_id === user.id && (
                                  <CheckCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                )}
                                <span className="truncate">{conv.last_message.content}</span>
                              </>
                            ) : (
                              <span className="italic text-slate-400">Tap to start chatting</span>
                            )}
                          </p>

                          {unreadCount > 0 && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] font-mono shrink-0 shadow-sm animate-pulse">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )
          )}

          {/* TAB 2: Group Chat Rooms */}
          {activeTab === "rooms" && (
            <div className="p-3 space-y-3">
              <button
                onClick={() => setShowCreateRoomModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md shadow-violet-600/25 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Group Chat Room</span>
              </button>

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-1">
                  Active Rooms ({publicRooms.length})
                </span>

                {publicRooms.map((room) => {
                  const isSelected = activeConversation?.id === room.id;
                  const isMember = room.is_member;
                  const unreadCount = unreadMap[room.id] || 0;

                  return (
                    <div
                      key={room.id}
                      onClick={() => (isMember ? handleSelectConversation(room) : handleJoinRoom(room))}
                      className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition border ${
                        isSelected
                          ? "bg-violet-950/40 border-violet-500/50"
                          : "bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20 shrink-0 font-bold text-sm">
                        #
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="text-xs font-bold text-white truncate">{room.title}</h4>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-violet-500 text-white font-bold text-[10px] font-mono">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {room.description || "Public community discussion room"}
                        </p>
                        <span className="text-[10px] text-violet-400/90 font-mono mt-1 inline-block">
                          👥 {room.member_count} members
                        </span>
                      </div>

                      {!isMember && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJoinRoom(room);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition shrink-0"
                        >
                          Join
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Discover Contacts */}
          {activeTab === "contacts" && (
            allUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                <p className="font-semibold text-slate-400">No other contacts found</p>
              </div>
            ) : (
              allUsers.map((targetUser) => {
                const isOnline = onlineUsers.has(targetUser.id);
                return (
                  <div
                    key={targetUser.id}
                    onClick={() => handleSelectUser(targetUser)}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={targetUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${targetUser.email}`}
                          alt={targetUser.name}
                          className="w-10 h-10 rounded-full bg-slate-800 object-cover border border-slate-700/80"
                        />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                        )}
                      </div>

                      <div className="truncate">
                        <h3 className="text-xs font-semibold text-white truncate">
                          {targetUser.name}
                        </h3>
                        <p className="text-[10px] text-indigo-300/80 truncate">
                          {targetUser.status_text || targetUser.email}
                        </p>
                        {targetUser.phone && (
                          <p className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            <span>{targetUser.phone}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <button className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-600 hover:text-white transition cursor-pointer">
                      Chat
                    </button>
                  </div>
                );
              })
            )
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* RIGHT CHAT WINDOW: Real-time Message Stream               */}
      {/* ========================================================= */}
      <main
        className={`${
          showMobileChat ? "flex" : "hidden md:flex"
        } flex-1 flex-col h-full bg-slate-950 relative`}
      >
        {activeConversation ? (
          <>
            {/* Chat Top Header */}
            <div className="p-3 px-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/80 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileChat(false)}
                  className="md:hidden p-1.5 -ml-1 text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative">
                  {activeConversation.type === "group" ? (
                    <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-base border border-violet-500/30">
                      #
                    </div>
                  ) : (
                    <>
                      <img
                        src={
                          activeConversation.participant?.avatar_url ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${activeConversation.participant?.email}`
                        }
                        alt={activeConversation.participant?.name}
                        className="w-10 h-10 rounded-full bg-slate-800 object-cover border border-slate-700"
                      />
                      {isPartnerOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900" />
                      )}
                    </>
                  )}
                </div>

                <div>
                  <h2 className="text-xs font-bold text-white flex items-center gap-2">
                    {activeConversation.type === "group"
                      ? activeConversation.title
                      : activeConversation.participant?.name}
                  </h2>

                  <div className="flex items-center gap-2">
                    {activeConversation.type === "group" ? (
                      <span className="text-[11px] text-violet-400 font-mono">
                        👥 {activeConversation.member_count} Members • Public Room
                      </span>
                    ) : (
                      <>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {activeConversation.participant?.email}
                        </span>
                        {activeConversation.participant?.phone && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              {activeConversation.participant.phone}
                            </span>
                          </>
                        )}
                        <span className="text-slate-600">•</span>
                        <p className="text-[11px] flex items-center gap-1">
                          {isPartnerTyping ? (
                            <span className="text-indigo-400 font-semibold italic animate-pulse">
                              typing a message...
                            </span>
                          ) : isPartnerOnline ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="text-slate-400">Offline</span>
                          )}
                        </p>
                        {activeConversation.participant?.status_text && (
                          <>
                            <span className="text-slate-600 hidden sm:inline">•</span>
                            <span className="text-[10px] text-slate-400 italic truncate max-w-[140px] sm:max-w-xs hidden sm:inline">
                              "{activeConversation.participant.status_text}"
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowInChatSearch(!showInChatSearch);
                    if (showInChatSearch) setInChatSearch("");
                  }}
                  title="Search inside this chat"
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    showInChatSearch
                      ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/30"
                      : "text-slate-400 hover:text-white border-slate-800"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setShowStarredOnly(!showStarredOnly)}
                  title={showStarredOnly ? "Show all messages" : "Filter starred messages"}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    showStarredOnly
                      ? "text-amber-400 bg-amber-500/20 border-amber-500/40 shadow-sm shadow-amber-500/20"
                      : "text-slate-400 hover:text-amber-400 border-slate-800"
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${showStarredOnly ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>

                <button
                  onClick={handleExportChat}
                  title="Export chat transcript (.txt)"
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-slate-800 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleClearChat}
                  title="Clear chat history"
                  className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Starred Messages Banner */}
            {showStarredOnly && (
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-300 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">Showing Starred Messages Only</span>
                </div>
                <button
                  onClick={() => setShowStarredOnly(false)}
                  className="text-[11px] underline hover:text-white cursor-pointer font-medium"
                >
                  Show All Messages
                </button>
              </div>
            )}

            {/* Inline In-Chat Search Bar */}
            {showInChatSearch && (
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex-1 flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    autoFocus
                    value={inChatSearch}
                    onChange={(e) => setInChatSearch(e.target.value)}
                    placeholder="Search keywords in this conversation..."
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                  />
                  {inChatSearch && (
                    <button onClick={() => setInChatSearch("")} className="text-slate-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {inChatSearch.trim()
                    ? `${messages.filter((m) => (m.content || "").toLowerCase().includes(inChatSearch.toLowerCase())).length} found`
                    : `${messages.length} total`}
                </span>
              </div>
            )}

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/30 via-slate-950 to-slate-950">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  <Clock className="w-4 h-4 animate-spin mr-2 text-indigo-400" />
                  Loading message history...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-slate-300 text-sm">
                    Say Hello to{" "}
                    {activeConversation.type === "group"
                      ? activeConversation.title
                      : activeConversation.participant?.name}! 👋
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Messages are synchronized in real-time across all connected clients via WebSockets.
                  </p>
                </div>
              ) : (
                messages
                  .filter((m) => (!showStarredOnly || m.is_starred))
                  .filter((m) =>
                    inChatSearch.trim()
                      ? (m.content || "").toLowerCase().includes(inChatSearch.toLowerCase()) ||
                        (m.sender_name || "").toLowerCase().includes(inChatSearch.toLowerCase())
                      : true
                  )
                  .map((msg) => {
                  const isMe = msg.sender_id === user.id;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      {/* In Group chat, display sender name and avatar for other participants */}
                      {!isMe && activeConversation.type === "group" && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <img
                            src={msg.sender_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.sender_id}`}
                            alt={msg.sender_name}
                            className="w-4 h-4 rounded-full bg-slate-800"
                          />
                          <span className="text-[10px] font-bold text-violet-400">
                            {msg.sender_name || "Member"}
                          </span>
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-md group ${
                          isMe
                            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-tr-none"
                            : "bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none"
                        }`}
                      >
                        {/* Multimedia Image Rendering */}
                        {msg.file_url && msg.message_type === "image" && (
                          <div className="mb-2 relative group">
                            <img
                              src={msg.file_url}
                              alt={msg.content || "Attached Photo"}
                              onClick={() => setPreviewModalImage(msg.file_url)}
                              className="rounded-xl max-h-60 w-auto object-cover cursor-pointer hover:opacity-95 transition border border-white/10"
                            />
                            <button
                              onClick={() => setPreviewModalImage(msg.file_url)}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Voice Audio Note Player */}
                        {msg.message_type === "audio" && msg.file_url && (
                          <div className="my-1.5 p-2 bg-slate-950/70 rounded-xl border border-white/10 flex items-center gap-2">
                            <audio controls src={msg.file_url} className="h-8 max-w-[210px] sm:max-w-[260px] outline-none" />
                          </div>
                        )}

                        {/* Text Content */}
                        {msg.content && msg.message_type !== "audio" && (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}

                        <div
                          className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] font-mono ${
                            isMe ? "text-indigo-200" : "text-slate-400"
                          }`}
                        >
                          {/* Star / Unstar Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleStar(msg.id)}
                            title={msg.is_starred ? "Unstar message" : "Star message"}
                            className={`p-0.5 transition cursor-pointer ${
                              msg.is_starred
                                ? "text-amber-400"
                                : "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-400"
                            }`}
                          >
                            <Star className={`w-2.5 h-2.5 ${msg.is_starred ? "fill-amber-400 text-amber-400" : ""}`} />
                          </button>

                          {/* Reaction Trigger Button */}
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionMessageId(
                                  activeReactionMessageId === msg.id ? null : msg.id
                                )
                              }
                              title="Add reaction"
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                            >
                              <Smile className="w-2.5 h-2.5" />
                            </button>

                            {activeReactionMessageId === msg.id && (
                              <div className="absolute bottom-6 right-0 z-30 bg-slate-900 border border-slate-700 rounded-2xl p-1 shadow-2xl flex items-center gap-1 animate-in zoom-in-95">
                                {reactionEmojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      handleReact(msg.id, emoji);
                                      setActiveReactionMessageId(null);
                                    }}
                                    className="text-xs p-1 hover:scale-125 transition cursor-pointer"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {isMe && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              title="Delete message"
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-indigo-300 hover:text-red-300 transition cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {msg.is_starred && (
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" />
                          )}
                          <span>{formatTime(msg.created_at)}</span>
                          {isMe && <CheckCheck className="w-3 h-3 text-cyan-200" />}
                        </div>
                      </div>

                      {/* Display Reaction Badges Below Bubble */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div
                          className={`flex flex-wrap gap-1 mt-1 px-1 ${
                            isMe ? "justify-end" : "justify-start"
                          }`}
                        >
                          {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                            if (!Array.isArray(userIds) || userIds.length === 0) return null;
                            const hasReacted = userIds.includes(user.id);
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReact(msg.id, emoji)}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition ${
                                  hasReacted
                                    ? "bg-indigo-500/25 border-indigo-500/60 text-indigo-300 font-bold"
                                    : "bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-mono text-[9px]">{userIds.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Real SMS Indicator bar if direct recipient has a phone number */}
            {activeConversation.type === "direct" && activeConversation.participant?.phone && (
              <div className="px-4 py-1.5 bg-emerald-950/40 border-t border-emerald-900/30 flex items-center justify-between text-[11px] text-emerald-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  Real SMS / WhatsApp Linked: {activeConversation.participant.phone}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  Messages dispatch to physical mobile device
                </span>
              </div>
            )}

            {/* Image Preview Bar when user has selected an image */}
            {selectedImage && (
              <div className="px-4 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between animate-in fade-in">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedImage.dataUrl}
                    alt="Upload Preview"
                    className="w-12 h-12 object-cover rounded-xl border border-indigo-500/40 shadow-md"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block truncate max-w-xs">
                      {selectedImage.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {(selectedImage.size / 1024).toFixed(1)} KB • Image ready to send
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick Emoji Bar Strip */}
            {showEmojiBar && (
              <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] text-slate-400 font-medium mr-1 shrink-0">Emojis:</span>
                {quickEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                    }}
                    className="p-1.5 text-base hover:scale-125 transition cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Bottom Chat Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 md:p-4 border-t border-slate-800/80 bg-slate-900/90 flex items-center gap-2"
            >
              {/* Hidden File Input for Image Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileSelect}
                className="hidden"
              />

              {isRecording ? (
                /* Active Voice Recording Strip */
                <div className="flex-1 flex items-center justify-between bg-red-950/40 border border-red-500/30 rounded-2xl px-4 py-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2.5 text-red-400 text-xs font-mono">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="font-semibold">
                      Recording Voice Note: {Math.floor(recordingDuration / 60)}:
                      {(recordingDuration % 60).toString().padStart(2, "0")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={stopAndSendVoiceRecording}
                      className="px-3 py-1 text-[11px] font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Send Voice</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Multimedia Image Upload Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Send photo / image"
                    className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition cursor-pointer shrink-0"
                  >
                    <Image className="w-5 h-5" />
                  </button>

                  {/* Emoji Picker Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiBar(!showEmojiBar)}
                    title="Quick emojis"
                    className={`p-2.5 rounded-xl transition cursor-pointer shrink-0 ${
                      showEmojiBar
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                    }`}
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder={
                      selectedImage
                        ? "Add a caption..."
                        : activeConversation.type === "group"
                        ? `Message #${activeConversation.title}...`
                        : `Message ${activeConversation.participant?.name}...`
                    }
                    className="flex-1 bg-slate-950/90 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 outline-none transition"
                  />

                  {/* Voice Note Recording Microphone Button */}
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    title="Hold or click to record voice note"
                    className="p-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer shrink-0"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <button
                    type="submit"
                    disabled={!inputText.trim() && !selectedImage}
                    className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </>
              )}
            </form>
          </>
        ) : (
          // ================= Empty State =================
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600/20 via-violet-600/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10">
              <MessageSquare className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">ChatPulse Web Messenger</h2>
            <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
              Real-time messaging with live WebSockets, group chat rooms, multimedia photo sharing, and audio notifications.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                onClick={() => setShowCreateRoomModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition cursor-pointer"
              >
                <Hash className="w-4 h-4" />
                <span>Create Group Chat Room</span>
              </button>

              <button
                onClick={() => setShowPhoneModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Message a Contact Number</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs max-w-xl text-left">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300">
                <span className="font-semibold text-white block mb-0.5">🌐 Group Chat Rooms</span>
                Join public channels like #General or create custom team rooms.
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300">
                <span className="font-semibold text-white block mb-0.5">📷 Photo & File Sharing</span>
                Share photos directly inside the real-time chat with preview.
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300">
                <span className="font-semibold text-white block mb-0.5">🔔 Audio Notifications</span>
                Sweet synthesized chime and unread counter badges.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
