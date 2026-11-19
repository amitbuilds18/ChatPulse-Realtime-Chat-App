import { Router } from "express";
import { getUsers, getUserById, getUserByPhone } from "../controllers/userController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.use(protect); // Protect all user routes

router.get("/", getUsers);
router.post("/by-phone", getUserByPhone);
router.get("/:id", getUserById);

export default router;
