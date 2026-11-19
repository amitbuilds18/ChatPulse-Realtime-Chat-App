import { Router } from "express";
import { register, login, getMe, updatePhone, sendOtp, verifyOtp, updateProfile } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/me", protect, getMe);
router.put("/phone", protect, updatePhone);
router.put("/profile", protect, updateProfile);
router.post("/logout", (_req, res) => {
  res.status(200).json({ message: "Logged out successfully" });
});

export default router;
