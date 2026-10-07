import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  price: z.coerce.number().positive(),
  category: z.string().trim().min(1).max(100),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const announcementIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const announcementListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
});