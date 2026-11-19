import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingMap, setTypingMap] = useState({}); // conversationId -> userName

  const socketRef = useRef(null);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    // Connect to Socket.IO backend on port 5001
    const newSocket = io("http://localhost:5001", {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("⚡ Connected to ChatPulse Real-Time Gateway:", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("⚡ Socket.IO connection status:", err.message);
    });

    // Handle initial presence list
    newSocket.on("presence:init", ({ onlineUsers: usersList }) => {
      setOnlineUsers(new Set(usersList));
    });

    // Handle real-time presence updates (user joins or disconnects)
    newSocket.on("presence:update", ({ userId, status, onlineUsers: updatedList }) => {
      setOnlineUsers(new Set(updatedList));
    });

    // Handle typing indicators
    newSocket.on("typing:update", ({ conversationId, userName, isTyping }) => {
      setTypingMap((prev) => {
        const copy = { ...prev };
        if (isTyping) {
          copy[conversationId] = userName;
        } else {
          delete copy[conversationId];
        }
        return copy;
      });
    });

    newSocket.on("disconnect", (reason) => {
      console.log("🔌 Disconnected from socket server:", reason);
    });

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [token, user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, typingMap }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
