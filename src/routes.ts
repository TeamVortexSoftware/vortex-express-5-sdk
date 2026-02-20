import { Request, Response, Router } from 'express';
import { handleJwtGeneration } from './handlers/jwt';
import {
  handleGetInvitationsByTarget,
  handleGetInvitation,
  handleRevokeInvitation,
  handleAcceptInvitations,
  handleGetInvitationsByGroup,
  handleDeleteInvitationsByGroup,
  handleReinvite,
  handleSyncInternalInvitation,
} from './handlers/invitations';

/**
 * Expected route paths that match the React provider's API calls
 * This ensures the Express routes and React provider stay in sync
 */
export const VORTEX_ROUTES = {
  JWT: '/jwt',
  INVITATIONS: '/invitations',
  INVITATION: '/invitations/:invitationId',
  INVITATIONS_ACCEPT: '/invitations/accept',
  INVITATIONS_BY_GROUP: '/invitations/by-group/:groupType/:groupId',
  INVITATION_REINVITE: '/invitations/:invitationId/reinvite',
  SYNC_INTERNAL_INVITATION: '/invitation-actions/sync-internal-invitation',
} as const;

/**
 * Utility to create the full API path based on base URL
 */
export function createVortexApiPath(baseUrl: string, route: keyof typeof VORTEX_ROUTES): string {
  return `${baseUrl.replace(/\/$/, '')}${VORTEX_ROUTES[route]}`;
}

/**
 * Creates individual route handlers for JWT endpoint
 */
export function createVortexJwtRoute(): (req: Request, res: Response) => Promise<Response> {
  return async function(req: Request, res: Response) {
    return handleJwtGeneration(req, res);
  };
}

/**
 * Creates individual route handlers for invitations endpoint
 */
export function createVortexInvitationsRoute(): (req: Request, res: Response) => Promise<Response> {
  return async function(req: Request, res: Response) {
    return handleGetInvitationsByTarget(req, res);
  };
}

/**
 * Creates individual route handlers for single invitation endpoint
 */
export function createVortexInvitationRoute(): {
  get: (req: Request, res: Response) => Promise<Response>;
  delete: (req: Request, res: Response) => Promise<Response>;
} {
  return {
    get: async function(req: Request, res: Response) {
      return handleGetInvitation(req, res);
    },
    delete: async function(req: Request, res: Response) {
      return handleRevokeInvitation(req, res);
    },
  };
}

/**
 * Creates individual route handlers for invitations accept endpoint
 */
export function createVortexInvitationsAcceptRoute(): (req: Request, res: Response) => Promise<Response> {
  return async function(req: Request, res: Response) {
    return handleAcceptInvitations(req, res);
  };
}

/**
 * Creates individual route handlers for invitations by group endpoint
 */
export function createVortexInvitationsByGroupRoute(): {
  get: (req: Request, res: Response) => Promise<Response>;
  delete: (req: Request, res: Response) => Promise<Response>;
} {
  return {
    get: async function(req: Request, res: Response) {
      return handleGetInvitationsByGroup(req, res);
    },
    delete: async function(req: Request, res: Response) {
      return handleDeleteInvitationsByGroup(req, res);
    },
  };
}

/**
 * Creates individual route handlers for reinvite endpoint
 */
export function createVortexReinviteRoute(): (req: Request, res: Response) => Promise<Response> {
  return async function(req: Request, res: Response) {
    return handleReinvite(req, res);
  };
}

/**
 * Creates individual route handlers for sync internal invitation endpoint
 */
export function createVortexSyncInternalInvitationRoute(): (req: Request, res: Response) => Promise<Response> {
  return async function(req: Request, res: Response) {
    return handleSyncInternalInvitation(req, res);
  };
}

/**
 * Creates all Vortex routes for easy registration
 * This provides individual handlers that can be attached to specific routes
 */
export function createVortexRoutes(): {
  jwt: (req: Request, res: Response) => Promise<Response>;
  invitations: (req: Request, res: Response) => Promise<Response>;
  invitation: {
    get: (req: Request, res: Response) => Promise<Response>;
    delete: (req: Request, res: Response) => Promise<Response>;
  };
  invitationsAccept: (req: Request, res: Response) => Promise<Response>;
  invitationsByGroup: {
    get: (req: Request, res: Response) => Promise<Response>;
    delete: (req: Request, res: Response) => Promise<Response>;
  };
  invitationReinvite: (req: Request, res: Response) => Promise<Response>;
  syncInternalInvitation: (req: Request, res: Response) => Promise<Response>;
} {
  return {
    jwt: createVortexJwtRoute(),
    invitations: createVortexInvitationsRoute(),
    invitation: createVortexInvitationRoute(),
    invitationsAccept: createVortexInvitationsAcceptRoute(),
    invitationsByGroup: createVortexInvitationsByGroupRoute(),
    invitationReinvite: createVortexReinviteRoute(),
    syncInternalInvitation: createVortexSyncInternalInvitationRoute(),
  };
}

/**
 * Creates a complete Express router with all Vortex routes configured
 * This is the easiest way to integrate Vortex into an Express app
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { createVortexRouter } from '@teamvortexsoftware/vortex-express-5-sdk';
 *
 * const app = express();
 * app.use(express.json()); // Required for parsing JSON bodies
 * app.use('/api/vortex', createVortexRouter());
 * ```
 */
export function createVortexRouter(): Router {
  const router = Router();
  const routes = createVortexRoutes();

  // Register all routes
  router.post(VORTEX_ROUTES.JWT, routes.jwt);
  router.get(VORTEX_ROUTES.INVITATIONS, routes.invitations);
  router.get(VORTEX_ROUTES.INVITATION, routes.invitation.get);
  router.delete(VORTEX_ROUTES.INVITATION, routes.invitation.delete);
  router.post(VORTEX_ROUTES.INVITATIONS_ACCEPT, routes.invitationsAccept);
  router.get(VORTEX_ROUTES.INVITATIONS_BY_GROUP, routes.invitationsByGroup.get);
  router.delete(VORTEX_ROUTES.INVITATIONS_BY_GROUP, routes.invitationsByGroup.delete);
  router.post(VORTEX_ROUTES.INVITATION_REINVITE, routes.invitationReinvite);
  router.post(VORTEX_ROUTES.SYNC_INTERNAL_INVITATION, routes.syncInternalInvitation);

  return router;
}

/**
 * Manual route registration helper for more control
 * Use this if you want to register routes individually or with custom paths
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { registerVortexRoutes } from '@teamvortexsoftware/vortex-express-5-sdk';
 *
 * const app = express();
 * app.use(express.json());
 *
 * // Register with custom base path
 * registerVortexRoutes(app, '/api/v1/vortex');
 * ```
 */
export function registerVortexRoutes(app: { post: (path: string, handler: (req: Request, res: Response) => void) => void; get: (path: string, handler: (req: Request, res: Response) => void) => void; delete: (path: string, handler: (req: Request, res: Response) => void) => void }, basePath: string = '/api/vortex'): void {
  const routes = createVortexRoutes();
  const cleanBasePath = basePath.replace(/\/$/, '');

  // Register all routes with the base path
  app.post(`${cleanBasePath}${VORTEX_ROUTES.JWT}`, routes.jwt);
  app.get(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS}`, routes.invitations);
  app.get(`${cleanBasePath}${VORTEX_ROUTES.INVITATION}`, routes.invitation.get);
  app.delete(`${cleanBasePath}${VORTEX_ROUTES.INVITATION}`, routes.invitation.delete);
  app.post(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS_ACCEPT}`, routes.invitationsAccept);
  app.get(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS_BY_GROUP}`, routes.invitationsByGroup.get);
  app.delete(`${cleanBasePath}${VORTEX_ROUTES.INVITATIONS_BY_GROUP}`, routes.invitationsByGroup.delete);
  app.post(`${cleanBasePath}${VORTEX_ROUTES.INVITATION_REINVITE}`, routes.invitationReinvite);
  app.post(`${cleanBasePath}${VORTEX_ROUTES.SYNC_INTERNAL_INVITATION}`, routes.syncInternalInvitation);
}