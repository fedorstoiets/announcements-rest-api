import type { NextFunction, Request, Response } from "express";
import { unlink } from "node:fs/promises";
import type { ZodType } from "zod";

function validationError(res: Response, issues: unknown): void {
  res.status(400).json({
    message: "Validation failed",
    errors: issues,
  });
}

function cleanupUploadedFile(req: Request): void {
  if (req.file?.path) {
    void unlink(req.file.path).catch(() => undefined);
  }
}

export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      cleanupUploadedFile(req);
      validationError(res, parsed.error.issues);
      return;
    }

    req.body = parsed.data;
    next();
  };
}

export function validateParams(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);

    if (!parsed.success) {
      validationError(res, parsed.error.issues);
      return;
    }

    req.params = parsed.data as Request["params"];
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);

    if (!parsed.success) {
      validationError(res, parsed.error.issues);
      return;
    }

    next();
  };
}