import { Response } from "express";
import pool from "../config/db";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { normalizePhone } from "./authController";

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user?.id;
    const search = (req.query.search as string) || "";

    let query = `
      SELECT id, name, phone, email, avatar_url, COALESCE(status_text, 'Hey there! I am using ChatPulse.') AS status_text, created_at
      FROM chat.users
      WHERE id != $1
    `;
    const params: any[] = [currentUserId];

    if (search.trim()) {
      const cleanTerm = `%${search.trim().toLowerCase()}%`;
      const cleanPhone = `%${search.trim().replace(/[\s\-\(\)]/g, "")}%`;
      params.push(cleanTerm, cleanPhone);
      query += ` AND (LOWER(name) LIKE $2 OR LOWER(email) LIKE $2 OR phone LIKE $3)`;
    }

    query += " ORDER BY name ASC LIMIT 50";

    const result = await pool.query(query, params);
    res.status(200).json({ users: result.rows });
  } catch (error: any) {
    console.error("GetUsers Error:", error);
    res.status(500).json({ error: "Failed to fetch users.", detail: error.message });
  }
}

export async function getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT id, name, phone, email, avatar_url, COALESCE(status_text, 'Hey there! I am using ChatPulse.') AS status_text, created_at FROM chat.users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (error: any) {
    console.error("GetUserById Error:", error);
    res.status(500).json({ error: "Failed to fetch user.", detail: error.message });
  }
}

// POST /api/users/by-phone - Lookup user or auto-create contact by real phone number
export async function getUserByPhone(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      res.status(400).json({ error: "Phone number is required." });
      return;
    }

    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
      return;
    }

    const last10 = cleanDigits.slice(-10);
    const formatted = `+91${last10}`;

    // 1. Check if user already exists with this phone number
    const result = await pool.query(
      `SELECT id, name, phone, email, avatar_url, COALESCE(status_text, 'Hey there! I am using ChatPulse.') AS status_text 
       FROM chat.users 
       WHERE phone = $1 OR phone = $2 OR phone LIKE $3`,
      [formatted, last10, `%${last10}`]
    );

    if (result.rows.length > 0) {
      res.status(200).json({ user: result.rows[0], isNewContact: false });
      return;
    }

    // 2. If user does not exist yet, auto-create a contact record for this real phone number!
    const contactName = `Contact +91 ${last10}`;
    const dummyHash = "$2b$10$w9uQ9jI8gU7nF3qT2eR5mu1yN4v8U0w7u6z9r2k8s5t4e1a2b3c4d";
    const contactEmail = `phone_${last10}@mobile.chatpulse.com`;
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${last10}`;

    const createRes = await pool.query(
      `INSERT INTO chat.users (name, phone, email, password_hash, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, phone, email, avatar_url`,
      [contactName, formatted, contactEmail, dummyHash, avatarUrl]
    );

    console.log(`📱 [Real Mobile Contact Created] ${contactName} -> ${formatted}`);
    res.status(200).json({ user: createRes.rows[0], isNewContact: true });
  } catch (error: any) {
    console.error("GetUserByPhone Error:", error);
    res.status(500).json({ error: "Failed to connect to contact number.", detail: error.message });
  }
}
