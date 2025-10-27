import { Request, Response } from 'express';
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';
import { getVortexConfig } from '../config';
import { createApiResponse, createErrorResponse } from '../utils';

export async function handleJwtGeneration(req: Request, res: Response) {
  try {
    if (req.method !== 'POST') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const config = await getVortexConfig();

    if (!config.authenticateUser) {
      return createErrorResponse(res, 'JWT generation requires authentication configuration. Please configure authenticateUser hook.', 500);
    }

    const authenticatedUser = await config.authenticateUser(req, res);

    if (!authenticatedUser) {
      return createErrorResponse(res, 'Unauthorized', 401);
    }

    const vortex = new Vortex(config.apiKey);

    const jwt = vortex.generateJwt({
      userId: authenticatedUser.userId,
      identifiers: authenticatedUser.identifiers,
      groups: authenticatedUser.groups,
      role: authenticatedUser.role,
    });

    return createApiResponse(res, { jwt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    return createErrorResponse(res, message, 500);
  }
}