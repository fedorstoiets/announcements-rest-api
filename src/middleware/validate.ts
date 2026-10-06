import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

export const validateBody =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: result.error.issues,
      });
    }

    req.body = result.data;
    next();
  };

export const validateParams =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: result.error.issues,
      });
    }

    next();
  };

export const validateQuery =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: result.error.issues,
      });
    }

    next();
  };
