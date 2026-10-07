import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  getJwtSecret,
  normalizeTokenPayload,
  type TokenPayload,
} from "../utils/auth.ts";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const payload = normalizeTokenPayload(decoded, "access");

    if (!payload) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      message: "Unauthorized",
    });
  }
}