import type { Request, Response } from "express";
import prisma from "../../prisma/client.ts";
import logger from "../logger.ts";
import {
  deleteLocalUpload,
  uploadImageToCloudinary,
} from "../middleware/upload.ts";

const authorSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
} as const;

function announcementId(req: Request): number {
  return Number(req.params.id);
}

async function cleanupRequestFile(req: Request): Promise<void> {
  if (req.file?.path) {
    await deleteLocalUpload(req.file.path);
  }
}

export async function listAnnouncements(
  req: Request,
  res: Response,
): Promise<void> {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const sort = req.query.sort === "oldest" ? "oldest" : "newest";
  const perPage = 10;

  const where = search
    ? {
        title: {
          contains: search,
          mode: "insensitive" as const,
        },
      }
    : {};

  const [total, data] = await prisma.$transaction([
    prisma.announcement.count({
      where,
    }),
    prisma.announcement.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: {
        createdAt: sort === "oldest" ? "asc" : "desc",
      },
      include: {
        user: {
          select: authorSelect,
        },
      },
    }),
  ]);

  res.status(200).json({
    data,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / perPage),
      perPage,
    },
  });
}

export async function getAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  const announcement = await prisma.announcement.findUnique({
    where: {
      id: announcementId(req),
    },
    include: {
      user: {
        select: authorSelect,
      },
    },
  });

  if (!announcement) {
    res.status(404).json({
      message: "Announcement not found",
    });
    return;
  }

  res.status(200).json(announcement);
}

export async function createAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  let imageUrl: string | null = null;

  if (req.file) {
    imageUrl = await uploadImageToCloudinary(req.file.path);

    logger.info(
      {
        userId: req.user!.sub,
        imageUrl,
      },
      "Announcement photo uploaded",
    );
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      category: req.body.category,
      imageUrl,
      userId: req.user!.sub,
    },
    include: {
      user: {
        select: authorSelect,
      },
    },
  });

  logger.info(
    {
      announcementId: announcement.id,
      userId: req.user!.sub,
    },
    "Announcement created",
  );

  res.status(201).json(announcement);
}

export async function updateAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  const id = announcementId(req);

  const existing = await prisma.announcement.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!existing) {
    await cleanupRequestFile(req);
    res.status(404).json({
      message: "Announcement not found",
    });
    return;
  }

  if (existing.userId !== req.user!.sub) {
    await cleanupRequestFile(req);
    res.status(403).json({
      message: "Access denied",
    });
    return;
  }

  const hasBodyChanges = Object.keys(req.body).length > 0;

  if (!hasBodyChanges && !req.file) {
    res.status(400).json({
      message: "At least one field or image is required",
    });
    return;
  }

  let imageUrl: string | undefined;

  if (req.file) {
    imageUrl = await uploadImageToCloudinary(req.file.path);

    logger.info(
      {
        announcementId: id,
        userId: req.user!.sub,
        imageUrl,
      },
      "Announcement photo uploaded",
    );
  }

  const announcement = await prisma.announcement.update({
    where: {
      id,
    },
    data: {
      ...req.body,
      ...(imageUrl ? { imageUrl } : {}),
    },
    include: {
      user: {
        select: authorSelect,
      },
    },
  });

  res.status(200).json(announcement);
}

export async function deleteAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  const id = announcementId(req);

  const existing = await prisma.announcement.findUnique({
    where: {
      id,
    },
    select: {
      userId: true,
    },
  });

  if (!existing) {
    res.status(404).json({
      message: "Announcement not found",
    });
    return;
  }

  if (existing.userId !== req.user!.sub) {
    res.status(403).json({
      message: "Access denied",
    });
    return;
  }

  await prisma.announcement.delete({
    where: {
      id,
    },
  });

  res.status(204).end();
}