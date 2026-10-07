import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client.ts";
import logger from "../logger.ts";
import {
  generateTokenPair,
  getJwtSecret,
  hashPassword,
  normalizeTokenPayload,
  verifyPassword,
} from "../utils/auth.ts";

const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  createdAt: true,
} as const;

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password, name } = req.body;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    res.status(409).json({
      message: "Username or email already taken",
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: passwordHash,
      name,
    },
    select: publicUserSelect,
  });

  const tokens = generateTokenPair(user.id);

  await prisma.refreshToken.create({
    data: {
      token: tokens.refreshToken,
      userId: user.id,
    },
  });

  logger.info(
    {
      userId: user.id,
      username: user.username,
    },
    "User registered",
  );

  res.status(201).json({
    user,
    ...tokens,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  const userWithPassword = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (
    !userWithPassword ||
    !(await verifyPassword(password, userWithPassword.password))
  ) {
    res.status(401).json({
      message: "Invalid credentials",
    });
    return;
  }

  const tokens = generateTokenPair(userWithPassword.id);

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({
      where: {
        userId: userWithPassword.id,
      },
    }),
    prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: userWithPassword.id,
      },
    }),
  ]);

  const { password: _password, ...user } = userWithPassword;

  logger.info(
    {
      userId: user.id,
      username: user.username,
    },
    "User logged in",
  );

  res.status(200).json({
    user,
    ...tokens,
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, getJwtSecret());
    const payload = normalizeTokenPayload(decoded, "refresh");

    if (!payload) {
      res.status(401).json({
        message: "Invalid refresh token",
      });
      return;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: {
        token: refreshToken,
      },
    });

    if (!storedToken || storedToken.userId !== payload.sub) {
      res.status(401).json({
        message: "Invalid refresh token",
      });
      return;
    }

    const tokens = generateTokenPair(payload.sub);

    await prisma.$transaction([
      prisma.refreshToken.delete({
        where: {
          id: storedToken.id,
        },
      }),
      prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: payload.sub,
        },
      }),
    ]);

    res.status(200).json(tokens);
  } catch {
    res.status(401).json({
      message: "Invalid refresh token",
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: {
      userId: req.user!.sub,
    },
  });

  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: {
      id: req.user!.sub,
    },
    select: publicUserSelect,
  });

  if (!user) {
    res.status(404).json({
      message: "User not found",
    });
    return;
  }

  res.status(200).json(user);
}