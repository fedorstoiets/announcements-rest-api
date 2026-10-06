import type { Request, Response } from "express";
import prisma from "../../prisma/client.ts";

const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
} as const;

export const getAnnouncements = async (req: Request, res: Response) => {
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  const sort = req.query.sort === "oldest" ? "oldest" : "newest";

  const page =
    typeof req.query.page === "string" ? Number(req.query.page) : 1;

  const perPage = 10;

  const where = search
    ? {
        title: {
          contains: search,
          mode: "insensitive" as const,
        },
      }
    : {};

  const [data, total] = await prisma.$transaction([
    prisma.announcement.findMany({
      where,
      include: {
        user: {
          select: userSelect,
        },
      },
      orderBy: {
        createdAt: sort === "oldest" ? "asc" : "desc",
      },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.announcement.count({
      where,
    }),
  ]);

  return res.status(200).json({
    data,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / perPage),
      perPage,
    },
  });
};

export const getAnnouncementById = async (
  req: Request,
  res: Response,
) => {
  const id = Number(req.params.id);

  const announcement = await prisma.announcement.findUnique({
    where: {
      id,
    },
    include: {
      user: {
        select: userSelect,
      },
    },
  });

  if (!announcement) {
    return res.status(404).json({
      message: "Announcement not found",
    });
  }

  return res.status(200).json(announcement);
};

export const createAnnouncement = async (
  req: Request,
  res: Response,
) => {
  const { title, description, price, category } = req.body;

  const announcement = await prisma.announcement.create({
    data: {
      title,
      description,
      price,
      category,
      userId: req.user.sub,
    },
    include: {
      user: {
        select: userSelect,
      },
    },
  });

  return res.status(201).json(announcement);
};

export const updateAnnouncement = async (
  req: Request,
  res: Response,
) => {
  const id = Number(req.params.id);

  const existingAnnouncement = await prisma.announcement.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!existingAnnouncement) {
    return res.status(404).json({
      message: "Announcement not found",
    });
  }

  if (existingAnnouncement.userId !== req.user.sub) {
    return res.status(403).json({
      message: "Access denied",
    });
  }

  const announcement = await prisma.announcement.update({
    where: {
      id,
    },
    data: req.body,
    include: {
      user: {
        select: userSelect,
      },
    },
  });

  return res.status(200).json(announcement);
};

export const deleteAnnouncement = async (
  req: Request,
  res: Response,
) => {
  const id = Number(req.params.id);

  const existingAnnouncement = await prisma.announcement.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!existingAnnouncement) {
    return res.status(404).json({
      message: "Announcement not found",
    });
  }

  if (existingAnnouncement.userId !== req.user.sub) {
    return res.status(403).json({
      message: "Access denied",
    });
  }

  await prisma.announcement.delete({
    where: {
      id,
    },
  });

  return res.status(204).end();
};
