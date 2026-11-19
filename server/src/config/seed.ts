import bcrypt from "bcrypt";
import pool from "./db";

export async function seedDemoUsers() {
  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash("password123", saltRounds);

    const demoUsers = [
      {
        name: "Amit Kumar",
        phone: "+919876543210",
        email: "amit@codecraft.com",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=amit"
      },
      {
        name: "Rahul Sharma",
        phone: "+919123456789",
        email: "rahul@codecraft.com",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=rahul"
      },
      {
        name: "Priya Patel",
        phone: "+919988776655",
        email: "priya@codecraft.com",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=priya"
      }
    ];

    for (const u of demoUsers) {
      const existing = await pool.query("SELECT id FROM chat.users WHERE email = $1", [u.email]);
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO chat.users (name, phone, email, password_hash, avatar_url)
           VALUES ($1, $2, $3, $4, $5)`,
          [u.name, u.phone, u.email, passwordHash, u.avatar]
        );
      } else {
        await pool.query(
          `UPDATE chat.users SET name = $1, phone = $2, password_hash = $3, avatar_url = $4 WHERE id = $5`,
          [u.name, u.phone, passwordHash, u.avatar, existing.rows[0].id]
        );
      }
    }

    console.log("✅ WhatsApp demo users configured with Indian Phone Numbers:");
    console.log("   • Amit:  +91 98765 43210 (pass: password123)");
    console.log("   • Rahul: +91 91234 56789 (pass: password123)");
    console.log("   • Priya: +91 99887 76655 (pass: password123)");
  } catch (err: any) {
    console.error("Seed error:", err.message);
  }
}

if (require.main === module) {
  seedDemoUsers().then(() => pool.end());
}
