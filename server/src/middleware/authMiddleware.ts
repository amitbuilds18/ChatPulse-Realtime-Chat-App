import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function protect(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Access denied. No authorization token provided." });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error: any) {
    res.status(401).json({ error: "Invalid or expired token.", message: error.message });
  }
}
