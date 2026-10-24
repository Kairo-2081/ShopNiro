import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

/** Shape of the 400 body: `error` is a human sentence the UI can show, `issues` is for developers. */
export const validationErrorBody = (error: { issues: Array<{ path: PropertyKey[]; message: string }> }) => {
  const issues = error.issues.slice(0, 10).map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
  return { error: issues[0]?.message || 'Invalid request.', issues };
};

/**
 * Parses req.body with a zod schema and replaces it with the parsed value, so handlers only ever see
 * data that already passed the schema (trimmed, bounded, unknown keys removed unless the schema allows them).
 */
export const validateBody = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) return res.status(400).json(validationErrorBody(result.error));
  req.body = result.data;
  next();
};

/** Same for URL parameters such as :id. Parsed values are not written back; params stay strings. */
export const validateParams = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.params);
  if (!result.success) return res.status(400).json(validationErrorBody(result.error));
  next();
};
