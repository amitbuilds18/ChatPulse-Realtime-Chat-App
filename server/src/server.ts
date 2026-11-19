import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import pool from "./config/db";
import { initDatabase } from "./config/initDb";
import { setupSocketIO } from "./sockets/chatSocket";
import { PORT } from "./config/env";

// Create HTTP Server
const server = http.createServer(app);

// Graceful Port Collision Error Handling
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ [PORT CONFLICT] Port ${PORT} is already in use!`);
    console.error(`👉 Another terminal is already running the server on port ${PORT}.`);
    console.error(`👉 To free the port in PowerShell, run: Stop-Process -Name node -Force\n`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", err.message);
    process.exit(1);
  }
});

// Initialize Socket.IO Server with permissive local CORS for development
const io = new SocketIOServer(server, {
  cors: {
    origin: (_origin, callback) => {
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Setup Real-Time Socket Event Handlers & Presence
setupSocketIO(io);

// Bootstrap Database & Start Listening
async function startServer() {
  try {
    await initDatabase();

    server.listen(PORT, () => {
      console.log("=================================================");
      console.log(`🚀 ChatPulse Real-Time Server running on port ${PORT}`);
      console.log(`🌐 Server Health:   http://localhost:${PORT}/api/health`);
      console.log(`🗄️ Database Health: http://localhost:${PORT}/api/db/health`);
      console.log(`⚡ Socket.IO Active on port ${PORT}`);
      console.log("=================================================");
    });
  } catch (err: any) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();

// Graceful Shutdown on Process Termination (SIGINT / SIGTERM)
const gracefulShutdown = (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Closing server resources gracefully...`);

  // 1. Close Socket.IO connections
  io.close(() => {
    console.log("   • Socket.IO server closed.");
  });

  // 2. Stop accepting new HTTP requests
  server.close(async () => {
    console.log("   • HTTP server closed.");

    // 3. Drain and close PostgreSQL connection pool
    try {
      await pool.end();
      console.log("   • PostgreSQL connection pool closed.");
    } catch (err: any) {
      console.error("   • Error closing PostgreSQL pool:", err.message);
    }

    console.log("👋 Server shutdown complete. Port released.\n");
    process.exit(0);
  });

  // Force exit if hanging after 5 seconds
  setTimeout(() => {
    console.error("⚠️ Forcing shutdown after timeout.");
    process.exit(1);
  }, 5000);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

export { server, io };
