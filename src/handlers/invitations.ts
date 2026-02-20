import { Request, Response } from 'express';
import { Vortex } from '@teamvortexsoftware/vortex-node-22-sdk';
import { getVortexConfig, authenticateRequest } from '../config';
import { createApiResponse, createErrorResponse, parseRequestBody, validateRequiredFields, getQueryParam, getRouteParam, sanitizeInput } from '../utils';

export async function handleGetInvitationsByTarget(req: Request, res: Response) {
  try {
    if (req.method !== 'GET') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    // Get configuration and authenticate user
    const config = await getVortexConfig();
    const user = await authenticateRequest(req, res);

    // Check access control if hook is configured
    if (config.canAccessInvitationsByTarget) {
      const hasAccess = await config.canAccessInvitationsByTarget(req, res, user);
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!user) {
      // If no access control hook is configured, require authentication
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const targetType = sanitizeInput(getQueryParam(req, 'targetType')) as 'email' | 'username' | 'phoneNumber';
    const targetValue = sanitizeInput(getQueryParam(req, 'targetValue'));

    if (!targetType || !targetValue) {
      return createErrorResponse(res, 'targetType and targetValue query parameters are required', 400);
    }

    if (!['email', 'username', 'phoneNumber'].includes(targetType)) {
      return createErrorResponse(res, 'targetType must be email, username, or phoneNumber', 400);
    }

    const vortex = new Vortex(config.apiKey);
    const invitations = await vortex.getInvitationsByTarget(targetType, targetValue);
    return createApiResponse(res, { invitations });
  } catch (error) {
    console.error('Error in handleGetInvitationsByTarget:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}

export async function handleGetInvitation(req: Request, res: Response) {
  try {
    if (req.method !== 'GET') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const invitationId = getRouteParam(req, 'invitationId');
    const sanitizedId = sanitizeInput(invitationId);
    if (!sanitizedId) {
      return createErrorResponse(res, 'Invalid invitation ID', 400);
    }

    // Get configuration and authenticate user
    const config = await getVortexConfig();
    const user = await authenticateRequest(req, res);

    // Check access control if hook is configured
    if (config.canAccessInvitation) {
      const hasAccess = await config.canAccessInvitation(req, res, user, { invitationId: sanitizedId });
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const invitation = await vortex.getInvitation(sanitizedId);
    return createApiResponse(res, invitation);
  } catch (error) {
    console.error('Error in handleGetInvitation:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}

export async function handleRevokeInvitation(req: Request, res: Response) {
  try {
    if (req.method !== 'DELETE') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const invitationId = getRouteParam(req, 'invitationId');
    const sanitizedId = sanitizeInput(invitationId);
    if (!sanitizedId) {
      return createErrorResponse(res, 'Invalid invitation ID', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(req, res);

    if (config.canDeleteInvitation) {
      const hasAccess = await config.canDeleteInvitation(req, res, user, { invitationId: sanitizedId });
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    await vortex.revokeInvitation(sanitizedId);
    return createApiResponse(res, { success: true });
  } catch (error) {
    console.error('Error in handleRevokeInvitation:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}

export async function handleAcceptInvitations(req: Request, res: Response) {
  try {
    if (req.method !== 'POST') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const body = await parseRequestBody(req) as Record<string, unknown>;

    const { invitationIds, target, user } = body;

    if (!Array.isArray(invitationIds) || invitationIds.length === 0) {
      return createErrorResponse(res, 'invitationIds must be a non-empty array', 400);
    }

    // Sanitize invitation IDs
    const sanitizedIds: string[] = invitationIds.map((id: string) => sanitizeInput(id)).filter((id): id is string => Boolean(id));
    if (sanitizedIds.length !== invitationIds.length) {
      return createErrorResponse(res, 'Invalid invitation IDs provided', 400);
    }

    // Support both new format (user) and legacy format (target)
    if (!user && !target) {
      return createErrorResponse(res, 'Either user or target must be provided', 400);
    }

    let acceptData: any;

    if (user) {
      // New format: user object with email/phone
      const userObj = user as { email?: string; phone?: string; name?: string };
      if (!userObj.email && !userObj.phone) {
        return createErrorResponse(res, 'user must have either email or phone', 400);
      }
      acceptData = {
        email: userObj.email ? sanitizeInput(userObj.email) : undefined,
        phone: userObj.phone ? sanitizeInput(userObj.phone) : undefined,
        name: userObj.name ? sanitizeInput(userObj.name) : undefined,
      };
    } else {
      // Legacy format: target object
      const targetObj = target as { type?: string; value?: string };

      if (!targetObj.type || !targetObj.value) {
        return createErrorResponse(res, 'target must have type and value properties', 400);
      }

      if (!['email', 'username', 'phoneNumber', 'phone'].includes(targetObj.type)) {
        return createErrorResponse(res, 'target.type must be email, username, phoneNumber, or phone', 400);
      }

      acceptData = {
        type: targetObj.type,
        value: sanitizeInput(targetObj.value) || targetObj.value
      };
    }

    const config = await getVortexConfig();
    const authenticatedUser = await authenticateRequest(req, res);

    if (config.canAcceptInvitations) {
      const resource = {
        invitationIds: sanitizedIds,
        target: target as { type: string; value: string } | undefined,
        user: user as { email?: string; phone?: string; name?: string } | undefined,
      };
      const hasAccess = await config.canAcceptInvitations(req, res, authenticatedUser, resource);
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!authenticatedUser) {
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const result = await vortex.acceptInvitations(sanitizedIds, acceptData);
    return createApiResponse(res, result);
  } catch (error) {
    console.error('Error in handleAcceptInvitations:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}

export async function handleGetInvitationsByGroup(req: Request, res: Response) {
  try {
    if (req.method !== 'GET') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const groupType = getRouteParam(req, 'groupType');
    const groupId = getRouteParam(req, 'groupId');
    const sanitizedGroupType = sanitizeInput(groupType);
    const sanitizedGroupId = sanitizeInput(groupId);

    if (!sanitizedGroupType || !sanitizedGroupId) {
      return createErrorResponse(res, 'Invalid group parameters', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(req, res);

    if (config.canAccessInvitationsByGroup) {
      const hasAccess = await config.canAccessInvitationsByGroup(req, res, user, {
        groupType: sanitizedGroupType,
        groupId: sanitizedGroupId
      });
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const invitations = await vortex.getInvitationsByGroup(sanitizedGroupType, sanitizedGroupId);
    return createApiResponse(res, { invitations });
  } catch (error) {
    console.error('Error in handleGetInvitationsByGroup:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}

export async function handleDeleteInvitationsByGroup(req: Request, res: Response) {
  try {
    if (req.method !== 'DELETE') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const groupType = getRouteParam(req, 'groupType');
    const groupId = getRouteParam(req, 'groupId');
    const sanitizedGroupType = sanitizeInput(groupType);
    const sanitizedGroupId = sanitizeInput(groupId);

    if (!sanitizedGroupType || !sanitizedGroupId) {
      return createErrorResponse(res, 'Invalid group parameters', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(req, res);

    if (config.canDeleteInvitationsByGroup) {
      const hasAccess = await config.canDeleteInvitationsByGroup(req, res, user, {
        groupType: sanitizedGroupType,
        groupId: sanitizedGroupId
      });
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    await vortex.deleteInvitationsByGroup(sanitizedGroupType, sanitizedGroupId);
    return createApiResponse(res, { success: true });
  } catch (error) {
    console.error('Error in handleDeleteInvitationsByGroup:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}

export async function handleSyncInternalInvitation(req: Request, res: Response) {
  try {
    if (req.method !== 'POST') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const body = await parseRequestBody(req) as Record<string, unknown>;

    const { creatorId, targetValue, action, componentId } = body;

    if (!creatorId || typeof creatorId !== 'string') {
      return createErrorResponse(res, 'creatorId is required and must be a string', 400);
    }
    if (!targetValue || typeof targetValue !== 'string') {
      return createErrorResponse(res, 'targetValue is required and must be a string', 400);
    }
    if (!action || !['accepted', 'declined'].includes(action as string)) {
      return createErrorResponse(res, 'action is required and must be "accepted" or "declined"', 400);
    }
    if (!componentId || typeof componentId !== 'string') {
      return createErrorResponse(res, 'componentId is required and must be a string', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(req, res);

    if (config.canSyncInternalInvitation) {
      const hasAccess = await config.canSyncInternalInvitation(req, res, user, {
        creatorId: sanitizeInput(creatorId as string)!,
        targetValue: sanitizeInput(targetValue as string)!,
        action: action as string,
        componentId: sanitizeInput(componentId as string)!,
      });
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const result = await vortex.syncInternalInvitation({
      creatorId: sanitizeInput(creatorId as string)!,
      targetValue: sanitizeInput(targetValue as string)!,
      action: action as 'accepted' | 'declined',
      componentId: sanitizeInput(componentId as string)!,
    });
    return createApiResponse(res, result);
  } catch (error) {
    console.error('Error in handleSyncInternalInvitation:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}

export async function handleReinvite(req: Request, res: Response) {
  try {
    if (req.method !== 'POST') {
      return createErrorResponse(res, 'Method not allowed', 405);
    }

    const invitationId = getRouteParam(req, 'invitationId');
    const sanitizedId = sanitizeInput(invitationId);
    if (!sanitizedId) {
      return createErrorResponse(res, 'Invalid invitation ID', 400);
    }

    const config = await getVortexConfig();
    const user = await authenticateRequest(req, res);

    if (config.canReinvite) {
      const hasAccess = await config.canReinvite(req, res, user, { invitationId: sanitizedId });
      if (!hasAccess) {
        return createErrorResponse(res, 'Access denied', 403);
      }
    } else if (!user) {
      return createErrorResponse(res, 'Access denied. Configure access control hooks for invitation endpoints.', 403);
    }

    const vortex = new Vortex(config.apiKey);
    const invitation = await vortex.reinvite(sanitizedId);
    return createApiResponse(res, invitation);
  } catch (error) {
    console.error('Error in handleReinvite:', error);
    return createErrorResponse(res, 'An error occurred while processing your request', 500);
  }
}