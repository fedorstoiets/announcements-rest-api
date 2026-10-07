import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { randomUUID } from "node:crypto";

const SALT_ROUNDS = 10;

export interface TokenPayload {
  sub: number;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
  jti?: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function normalizeTokenPayload(
  decoded: string | JwtPayload,
  expectedType: "access" | "refresh",
): TokenPayload | null {
  if (
    typeof decoded === "string" ||
    decoded.type !== expectedType ||
    typeof decoded.sub !== "string"
  ) {
    return null;
  }

  const userId = Number(decoded.sub);

  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  return {
    sub: userId,
    type: expectedType,
    iat: decoded.iat,
    exp: decoded.exp,
    jti: decoded.jti,
  };
}

export function generateTokenPair(userId: number): {
  accessToken: string;
  refreshToken: string;
} {
  const secret = getJwtSecret();

  const accessToken = jwt.sign(
    {
      type: "access",
    },
    secret,
    {
      subject: String(userId),
      expiresIn: 15 * 60,
    },
  );

  const refreshToken = jwt.sign(
    {
      type: "refresh",
    },
    secret,
    {
      subject: String(userId),
      jwtid: randomUUID(),
      expiresIn: 7 * 24 * 60 * 60,
    },
  );

  return {
    accessToken,
    refreshToken,
  };
}