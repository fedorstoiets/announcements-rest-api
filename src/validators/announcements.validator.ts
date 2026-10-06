import { z } from "zod";

export const announcementIdSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/, "ID must be a positive integer"),
});

export const announcementsQuerySchema = z.object({
  search: z.string().optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
  page: z
    .string()
    .regex(/^[1-9]\d*$/, "Page must be a positive integer")
    .optional(),
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(5).max(50),
  description: z.string().min(10),
  price: z.number().positive(),
  category: z.enum(["sale", "service", "job", "other"]),
});

export const updateAnnouncementSchema = createAnnouncementSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
