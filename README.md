# 💬 ChatPulse – Real-Time Chat Application
### CodeCraft Infotech Internship – Task 04

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)](https://socket.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-4169E1?logo=postgresql)](https://neon.tech/)

A production-quality, full-stack real-time messaging application engineered with clean architecture, secure authentication, responsive user interface, and real-time bi-directional messaging over WebSockets.

---

## 🏗️ Architecture Overview

The project is structured with a decoupled client-server architecture:

```
realtime-chat-app/
├── client/                     # Frontend Application (React + Vite + Tailwind CSS)
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── assets/             # Icons, illustrations, styles
│   │   ├── components/         # Reusable UI components (Sidebar, ChatBox, Messages, Modals)
│   │   ├── context/            # React Context (AuthContext, SocketContext, ChatContext)
│   │   ├── hooks/              # Custom React hooks (useSocket, useChat, useDebounce)
│   │   ├── pages/              # View pages (Login, Register, ChatDashboard)
│   │   ├── services/           # Axios API services (authService, chatService, userService)
│   │   ├── App.jsx             # Main router & layout root
│   │   ├── index.css           # Tailwind CSS imports & global styles
│   │   └── main.jsx            # Application bootstrap
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Backend Application (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/             # DB connection pool, environment loaders
│   │   ├── controllers/        # Request handlers (authController, userController, chatController)
│   │   ├── middleware/         # Auth verification, rate limiting, error handling
│   │   ├── routes/             # REST API routers (/api/auth, /api/users, /api/conversations)
│   │   ├── services/           # Business logic & database operations
│   │   ├── sockets/            # Socket.IO handlers, authentication, rooms, typing indicators
│   │   ├── utils/              # Token generators, password hashers, AppError class
│   │   ├── app.ts              # Express application setup & middleware stack
│   │   └── server.ts           # HTTP server bootstrap & Socket.IO initialization
│   ├── tsconfig.json
│   └── package.json
│
├── database/                   # Database Design & Migration Scripts
│   └── schema.sql              # PostgreSQL DDL schema with UUIDs & indexes
│
├── .env.example                # Sample environment configuration
├── .gitignore                  # Git exclusions for dependencies and sensitive files
└── README.md                   # Project documentation
```

---

## ⚡ Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite 6 | High-performance SPA with instant HMR |
| **Styling** | Tailwind CSS v4 | Modern, utility-first dark mode messaging UI |
| **State & Routing**| Context API + React Router v7 | Seamless client routing & global state |
| **Real-time Client**| Socket.IO Client 4.x | WebSocket client with reconnection logic |
| **Backend Runtime**| Node.js 22 + TypeScript 5 | Type-safe enterprise server architecture |
| **Web Framework** | Express 4.x | Robust HTTP REST API layer |
| **Real-time Server**| Socket.IO 4.x | Event-driven WebSocket server with room segregation |
| **Authentication** | JWT + bcrypt | Stateless bearer tokens with salted password hashing |
| **Database** | PostgreSQL (Neon Cloud) | ACID-compliant relational storage with UUID keys |
| **DB Client** | `pg` (node-postgres) | High-throughput connection pooling |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js `v18+` or `v20+` (Tested on Node `v22.20.0`)
- npm `v10+`
- PostgreSQL or free [Neon](https://neon.tech) database account

### 2. Installation

#### Clone & Enter the project:
```bash
git clone <your-repo-url>
cd realtime-chat-app
```

#### Setup Environment Variables:
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
# Open server/.env and fill in your DATABASE_URL and JWT_SECRET
```

#### Install Backend Dependencies:
```bash
cd server
npm install
```

#### Install Frontend Dependencies:
```bash
cd ../client
npm install
```

---

## 💻 Running the Application

### Running Backend (Development Mode)
```bash
cd server
npm run dev
# Server runs on: http://localhost:5001
# Health check: http://localhost:5001/api/health
```

### Running Frontend (Development Mode)
```bash
cd client
npm run dev
# Vite runs on: http://localhost:5173
```

---

## 🌟 Key Features Implemented

1. **⚡ Real-Time Instant Messaging (WebSocket / Socket.IO)**:
   - Bi-directional instant messaging with sub-second delivery.
   - Conversation room segregation (`conv_<id>`) and user private channels.
   - Message delivery indicators (`✓✓` double ticks) and timestamps.

2. **🌐 Group Chat Rooms & Channels**:
   - Create custom named rooms with titles and descriptions.
   - Public channels (`# General Discussion`, `# CodeCraft Interns Hub`).
   - One-click join and live multi-user real-time room communication.
   - Distinct sender names and avatars rendered on group messages.

3. **🔒 Secure Authentication & User Accounts**:
   - Full Name, Gmail/Email, and Salted Password hashing (`bcrypt`).
   - Stateless JWT Bearer token authentication with auto-refresh and auth guards.
   - Option to link real Indian mobile number with OTP verification.

4. **📷 Multimedia Photo & File Sharing**:
   - Inline photo attachment uploader with live preview and size validation.
   - Image rendering inside message bubbles with hover zoom actions.
   - Fullscreen click-to-zoom modal for high-resolution photo viewing.

5. **🎙️ Voice Audio Notes & Voice Messaging**:
   - Live in-browser microphone voice recorder using native `MediaRecorder` API.
   - Real-time recording timer with audio waveform animation.
   - Inline custom audio player with play/pause, progress scrubber, and duration.

6. **❤️ Live Message Emoji Reactions**:
   - React to any direct or group message with emojis (`❤️`, `👍`, `😂`, `🔥`, `🎉`, `😮`).
   - Synced in real-time across all connected clients via WebSockets and persisted in PostgreSQL.
   - Dynamic reaction badge counter pills on message bubbles.

7. **📥 Export Chat Transcript**:
   - Download complete chat history as a clean, timestamped `.txt` document with one click.

8. **🔔 Audio & Visual Notifications**:
   - Native Web Audio API synthesizer for pleasant two-tone incoming chime (`587Hz` -> `880Hz`) with 0 external dependencies.
   - Real-time unread message counter badges on direct chats and group rooms.
   - Web Notification API integration for desktop notifications when tab is minimized.

9. **🟢 User Presence & Typing Indicators**:
   - Real-time online/offline presence tracking via heartbeat.
   - Debounced live typing indicators (`typing...`) when contacts type.

10. **📱 Real SMS / WhatsApp Carrier Gateway**:
   - Built-in integration with Twilio & Fast2SMS telecom gateways.
   - Automatic fallback to Live Telecom Carrier Simulation mode.

11. **⭐ Starred Messages & In-Chat Keyword Search**:
   - Star and save key messages in direct chats and group channels with live WebSocket sync.
   - One-click Star filter button to view only starred/bookmarked messages.
   - Instant in-chat keyword search with live match counter and highlighting.

12. **👤 Profile Settings & WhatsApp-Style Status**:
   - Customizable profile avatar with instant Dicebear presets and display name editing.
   - WhatsApp-style live presence status ("🟢 Available", "💻 Coding...", "⚡ In a meeting", "⛔ Busy").
   - Status updates reflected in real-time across user contacts, headers, and conversation lists.

---

## 🗺️ 10-Phase Development Roadmap

- [x] **Phase 1**: Project initialization, directory structure, configurations, and toolchain verification.
- [x] **Phase 2**: Backend setup and PostgreSQL Neon database connection pool (`pg.Pool`).
- [x] **Phase 3**: Database schema execution and authentication REST APIs (`/register`, `/login`, `/me`).
- [x] **Phase 4**: React frontend authentication UI (Login/Register forms, validation, auth context).
- [x] **Phase 5**: User search and conversation REST APIs (`/api/users`, `/api/conversations`).
- [x] **Phase 6**: Socket.IO authenticated handshake & room joining architecture.
- [x] **Phase 7**: Real-time private 1-on-1 messaging with PostgreSQL persistence.
- [x] **Phase 8**: Chat history, live online/offline presence, typing indicators, and message timestamps.
- [x] **Phase 9**: Group Chat Rooms, Multimedia Photo Sharing, Audio Chime Notifications, and Unread Badges.
- [x] **Phase 10**: Ready for internship submission with full documentation.

---

## 📄 License & Attribution
Developed for **CodeCraft Infotech Internship – Task 04** by **Amit Kumar**.
All rights reserved © 2026.
