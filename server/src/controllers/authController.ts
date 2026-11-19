import { Request, Response } from "express";
import bcrypt from "bcrypt";
import pool from "../config/db";
import { generateToken } from "../utils/jwt";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { BCRYPT_SALT_ROUNDS } from "../config/env";
import { sendRealSMSOrWhatsApp } from "../services/smsService";

// Helper to normalize phone numbers
export function normalizePhone(rawPhone?: string): string | null {
  if (!rawPhone) return null;
  const cleaned = rawPhone.replace(/[\s\-\(\)]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+91")) return cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// REGISTER: Full Name, Gmail/Email, and Password (Phone is optional)
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, phone, avatar_url } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email address, and password are required." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters long." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const formattedPhone = phone ? normalizePhone(phone) : null;

    // Check if email already registered
    const existingEmail = await pool.query(
      "SELECT id FROM chat.users WHERE LOWER(email) = $1",
      [normalizedEmail]
    );

    if (existingEmail.rows.length > 0) {
      res.status(409).json({ error: "An account already exists with this email address. Please sign in." });
      return;
    }

    if (formattedPhone) {
      const existingPhone = await pool.query(
        "SELECT id FROM chat.users WHERE phone = $1",
        [formattedPhone]
      );

      if (existingPhone.rows.length > 0) {
        res.status(409).json({ error: "This phone number is already linked to another account." });
        return;
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const userAvatar =
      avatar_url ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedEmail)}`;

    // Insert user into chat.users
    const insertRes = await pool.query(
      `INSERT INTO chat.users (name, email, password_hash, phone, avatar_url, phone_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, avatar_url, phone_verified, created_at`,
      [name.trim(), normalizedEmail, password_hash, formattedPhone, userAvatar, !!formattedPhone]
    );

    const newUser = insertRes.rows[0];
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name
    });

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: newUser
    });
  } catch (error: any) {
    console.error("Register Error:", error);
    res.status(500).json({ error: "Server error during registration.", detail: error.message });
  }
}

// LOGIN: Email Address + Password (or Phone if provided)
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, identifier, phone, password } = req.body;
    const loginInput = email || identifier || phone;

    if (!loginInput || !password) {
      res.status(400).json({ error: "Email address and password are required." });
      return;
    }

    const trimmedInput = loginInput.trim();
    const normalizedEmail = trimmedInput.toLowerCase();
    const formattedPhone = normalizePhone(trimmedInput);

    // Query user by email OR phone
    const userRes = await pool.query(
      `SELECT * FROM chat.users 
       WHERE LOWER(email) = $1 OR phone = $2 OR phone = $3`,
      [normalizedEmail, formattedPhone, trimmedInput]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: "No account found with this email. Please check your credentials or create an account." });
      return;
    }

    const user = userRes.rows[0];

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Incorrect password. Please try again." });
      return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email || user.phone,
      name: user.name
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        phone_verified: user.phone_verified,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      }
    });
  } catch (error: any) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login.", detail: error.message });
  }
}

export async function sendOtp(req: Request, res: Response): Promise<void> {
  try {
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ error: "Phone number is required." });
      return;
    }

    const formattedPhone = normalizePhone(phone);

    if (!formattedPhone) {
      res.status(400).json({ error: "Please provide a valid mobile number." });
      return;
    }

    const userRes = await pool.query(
      "SELECT id, name, phone FROM chat.users WHERE phone = $1 OR phone = $2",
      [formattedPhone, phone.trim()]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "No account found for this phone number." });
      return;
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      "UPDATE chat.users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3",
      [otp, otpExpiry, userRes.rows[0].id]
    );

    await sendRealSMSOrWhatsApp({
      toPhone: formattedPhone,
      senderName: userRes.rows[0].name,
      messageContent: `Your OTP for ChatPulse is ${otp}. It is valid for 5 minutes.`
    });

    res.status(200).json({
      message: "OTP sent successfully.",
      phone: formattedPhone
    });
  } catch (error: any) {
    console.error("SendOtp Error:", error);
    res.status(500).json({ error: "Failed to send OTP.", detail: error.message });
  }
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      res.status(400).json({ error: "Phone number and OTP are required." });
      return;
    }

    const formattedPhone = normalizePhone(phone);
    if (!formattedPhone) {
      res.status(400).json({ error: "Please provide a valid mobile number." });
      return;
    }

    const userRes = await pool.query(
      "SELECT * FROM chat.users WHERE phone = $1 OR phone = $2",
      [formattedPhone, phone.trim()]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "No account found for this phone number." });
      return;
    }

    const user = userRes.rows[0];

    if (!user.otp_code || user.otp_code !== otp.trim()) {
      res.status(400).json({ error: "Invalid OTP. Please try again." });
      return;
    }

    if (!user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) {
      res.status(400).json({ error: "OTP has expired. Please request a new one." });
      return;
    }

    await pool.query(
      "UPDATE chat.users SET phone_verified = true, otp_code = NULL, otp_expires_at = NULL WHERE id = $1",
      [user.id]
    );

    res.status(200).json({
      message: "Phone number verified successfully.",
      phone: formattedPhone,
      verified: true
    });
  } catch (error: any) {
    console.error("VerifyOtp Error:", error);
    res.status(500).json({ error: "OTP verification failed.", detail: error.message });
  }
}

// UPDATE PHONE IN PROFILE: User can link their real phone number from Dashboard
export async function updatePhone(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { phone } = req.body;

    if (!phone) {
      res.status(400).json({ error: "Phone number is required." });
      return;
    }

    const formatted = normalizePhone(phone);
    if (!formatted) {
      res.status(400).json({ error: "Please provide a valid mobile number." });
      return;
    }

    // Check if phone already used by someone else
    const checkRes = await pool.query(
      "SELECT id FROM chat.users WHERE phone = $1 AND id != $2",
      [formatted, userId]
    );

    if (checkRes.rows.length > 0) {
      res.status(409).json({ error: "This phone number is already linked to another account." });
      return;
    }

    const updateRes = await pool.query(
      "UPDATE chat.users SET phone = $1, phone_verified = false, otp_code = NULL, otp_expires_at = NULL WHERE id = $2 RETURNING id, name, email, phone, avatar_url, phone_verified, created_at",
      [formatted, userId]
    );

    res.status(200).json({
      message: "Phone number updated successfully. Please verify it via OTP.",
      user: updateRes.rows[0]
    });
  } catch (error: any) {
    console.error("UpdatePhone Error:", error);
    res.status(500).json({ error: "Failed to update phone number.", detail: error.message });
  }
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const { name, avatar_url, status_text } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    const updateRes = await pool.query(
      `UPDATE chat.users 
       SET name = COALESCE($1, name),
           avatar_url = COALESCE($2, avatar_url),
           status_text = COALESCE($3, status_text)
       WHERE id = $4
       RETURNING id, name, email, phone, phone_verified, avatar_url, status_text, created_at`,
      [name?.trim() || null, avatar_url || null, status_text?.trim() || null, userId]
    );

    res.status(200).json({
      message: "Profile updated successfully.",
      user: updateRes.rows[0]
    });
  } catch (error: any) {
    console.error("UpdateProfile Error:", error);
    res.status(500).json({ error: "Failed to update profile.", detail: error.message });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }

    const userRes = await pool.query(
      "SELECT id, name, email, phone, phone_verified, avatar_url, COALESCE(status_text, 'Hey there! I am using ChatPulse.') AS status_text, created_at FROM chat.users WHERE id = $1",
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    res.status(200).json({ user: userRes.rows[0] });
  } catch (error: any) {
    console.error("GetMe Error:", error);
    res.status(500).json({ error: "Server error retrieving profile.", detail: error.message });
  }
}
