import { Router } from "express";
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcements.controller.ts";
import { authenticate } from "../middleware/authenticate.ts";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.ts";
import {
  announcementIdSchema,
  announcementsQuerySchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "../validators/announcements.validator.ts";

const router = Router();

router.get("/", validateQuery(announcementsQuerySchema), getAnnouncements);

router.get(
  "/:id",
  validateParams(announcementIdSchema),
  getAnnouncementById,
);

router.post(
  "/",
  authenticate,
  validateBody(createAnnouncementSchema),
  createAnnouncement,
);

router.patch(
  "/:id",
  authenticate,
  validateParams(announcementIdSchema),
  validateBody(updateAnnouncementSchema),
  updateAnnouncement,
);

router.delete(
  "/:id",
  authenticate,
  validateParams(announcementIdSchema),
  deleteAnnouncement,
);

export default router;
