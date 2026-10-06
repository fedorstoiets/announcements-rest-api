import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client.ts";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

const createTokens = (userId: number, username: string) => {
  const secret = getJwtSecret();

  const accessToken = jwt.sign(
    {
      sub: userId,
      username,
    },
    secret,
    {
      expiresIn: "15m",
    },
  );

  const refreshToken = jwt.sign(
    {
      sub: userId,
      username,
    },
    secret,
    {
      expiresIn: "7d",
      jwtid: randomUUID(),
    },
  );

  return {
    accessToken,
    refreshToken,
  };
};

export const register = async (req: Request, res: Response) => {
  const { username, email, password, name } = req.body;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    return res.status(409).json({
      message: "Username or email already taken",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      name,
    },
  });

  const { accessToken, refreshToken } = createTokens(
    user.id,
    user.username,
  );

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
    },
  });

  return res.status(201).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
    },
    accessToken,
    refreshToken,
  });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  const { accessToken, refreshToken } = createTokens(
    user.id,
    user.username,
  );

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
      },
    }),
    prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
      },
    }),
  ]);

  return res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
    },
    accessToken,
    refreshToken,
  });
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(refreshToken, secret);

    if (typeof decoded === "string") {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const userId = Number(decoded.sub);

    if (!Number.isInteger(userId)) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: {
        token: refreshToken,
      },
      include: {
        user: true,
      },
    });

    if (!storedToken || storedToken.userId !== userId) {
      return res.status(401).json({
        message: "Invalid refresh token",
      });
    }

    const newTokens = createTokens(
      storedToken.user.id,
      storedToken.user.username,
    );

    await prisma.$transaction([
      prisma.refreshToken.delete({
        where: {
          token: refreshToken,
        },
      }),
      prisma.refreshToken.create({
        data: {
          token: newTokens.refreshToken,
          userId: storedToken.user.id,
        },
      }),
    ]);

    return res.status(200).json(newTokens);
  } catch {
    return res.status(401).json({
      message: "Invalid refresh token",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  await prisma.refreshToken.deleteMany({
    where: {
      userId: req.user.sub,
    },
  });

  return res.status(204).end();
};

export const me = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: {
      id: req.user.sub,
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  return res.status(200).json(user);
};
