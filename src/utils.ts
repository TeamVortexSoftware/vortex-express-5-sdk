import { Request, Response } from 'express';

export function createApiResponse(res: Response, data: unknown, status: number = 200): Response {
  return res.status(status).json(data);
}

export function createErrorResponse(res: Response, message: string, status: number = 400): Response {
  return res.status(status).json({ error: message });
}

export async function parseRequestBody(request: Request): Promise<unknown> {
  // In Express 5, the body is already parsed by the built-in middleware
  // if express.json() middleware is used
  if (request.body) {
    return request.body;
  }
  throw new Error('Request body is empty or not parsed');
}

export function getQueryParam(request: Request, param: string): string | null {
  const value = request.query[param];
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return null;
}

export function getRouteParam(request: Request, param: string): string | null {
  const value = request.params[param];
  return typeof value === 'string' ? value : null;
}

export function validateRequiredFields(data: Record<string, unknown>, fields: string[]): void {
  const missing = fields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function sanitizeInput(input: string | null): string | null {
  if (!input) return null;

  // Basic input sanitization - remove potential XSS/injection characters
  return input
    .trim()
    .replace(/[<>'"]/g, '') // Remove basic XSS characters
    .substring(0, 1000); // Limit length to prevent DoS
}