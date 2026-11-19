import jwt, { SignOptions } from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config/env";

export interface TokenPayload {
  id: string;
  email: string;
  name: string;
}

export function generateToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
