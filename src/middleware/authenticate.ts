import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type AuthUser = {
  sub: number;
  username: string;
  iat?: number;
  exp?: number;
};

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const token = authHeader.substring(7);

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const decoded = jwt.verify(token, secret);

    if (typeof decoded === "string") {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    const sub = Number(decoded.sub);
    const username = decoded.username;

    if (!Number.isInteger(sub) || typeof username !== "string") {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    req.user = {
      sub,
      username,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};
