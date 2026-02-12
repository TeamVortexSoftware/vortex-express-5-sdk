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

    // Validate required fields
    if (!authenticatedUser.userId || !authenticatedUser.userEmail) {
      return createErrorResponse(res, 'Invalid user format: must provide userId and userEmail', 500);
    }

    // Generate JWT with new format
    const jwtParams: any = {
      user: {
        id: authenticatedUser.userId,
        email: authenticatedUser.userEmail,
        ...(authenticatedUser.userName && { userName: authenticatedUser.userName }),
        ...(authenticatedUser.userAvatarUrl && { userAvatarUrl: authenticatedUser.userAvatarUrl }),
        ...(authenticatedUser.adminScopes && authenticatedUser.adminScopes.length > 0 && {
          adminScopes: authenticatedUser.adminScopes
        }),
        ...(authenticatedUser.allowedEmailDomains && authenticatedUser.allowedEmailDomains.length > 0 && {
          allowedEmailDomains: authenticatedUser.allowedEmailDomains
        }),
      },
    };

    // Add attributes if present
    if (authenticatedUser.attributes) {
      jwtParams.attributes = authenticatedUser.attributes;
    }

    const jwt = vortex.generateJwt(jwtParams);

    return createApiResponse(res, { jwt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    return createErrorResponse(res, message, 500);
  }
}