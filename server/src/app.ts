import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import pool from "./config/db";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import conversationRoutes from "./routes/conversationRoutes";

const app: Application = express();

// Permissive local CORS for development
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or any local development origin
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REST API Routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);

// Server & Database Health Check Route
app.get("/api/health", async (_req: Request, res: Response) => {
  const startTime = Date.now();
  let dbStatus = "disconnected";
  let dbLatencyMs: number | null = null;
  let dbInfo: any = null;

  try {
    const dbRes = await pool.query(`
      SELECT 
        NOW() as db_time, 
        current_database() as database_name, 
        current_schema() as current_schema,
        version() as version
    `);
    dbLatencyMs = Date.now() - startTime;
    dbStatus = "connected";
    dbInfo = {
      database: dbRes.rows[0].database_name,
      schema: dbRes.rows[0].current_schema,
      timestamp: dbRes.rows[0].db_time,
      latencyMs: dbLatencyMs
    };
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  res.status(200).json({
    status: "ok",
    service: "realtime-chat-server",
    timestamp: new Date().toISOString(),
    phase: "Phase 3-8: Auth, Users, Conversations & Real-Time Socket.IO Configured",
    database: {
      status: dbStatus,
      info: dbInfo
    }
  });
});

// Dedicated DB Diagnostics Endpoint
app.get("/api/db/health", async (_req: Request, res: Response) => {
  try {
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'chat'
      ORDER BY table_name;
    `);

    res.status(200).json({
      status: "connected",
      engine: "PostgreSQL (Neon Cloud)",
      schema: "chat",
      tables: tablesRes.rows.map(r => r.table_name)
    });
  } catch (err: any) {
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    name: "ChatPulse Real-Time Chat API",
    version: "1.0.0",
    docs: "/api/health",
    db_status: "/api/db/health"
  });
});

// Centralized 404 Route Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled Error:", err.message);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

export default app;
