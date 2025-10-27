export { configureVortex, configureVortexAsync, configureVortexLazy, getVortexConfig, authenticateRequest, createAllowAllAccessControl } from './config';
export type {
  VortexConfig,
  AuthenticatedUser,
  AccessControlHook,
  InvitationResource,
  InvitationTargetResource,
  GroupResource,
  InvitationAccessHook,
  InvitationTargetAccessHook,
  GroupAccessHook,
  BasicAccessHook
} from './config';

export {
  createVortexJwtRoute,
  createVortexInvitationsRoute,
  createVortexInvitationRoute,
  createVortexInvitationsAcceptRoute,
  createVortexInvitationsByGroupRoute,
  createVortexReinviteRoute,
  createVortexRoutes,
  createVortexRouter,
  registerVortexRoutes,
  VORTEX_ROUTES,
  createVortexApiPath,
} from './routes';

export {
  handleJwtGeneration,
} from './handlers/jwt';

export {
  handleGetInvitationsByTarget,
  handleGetInvitation,
  handleRevokeInvitation,
  handleAcceptInvitations,
  handleGetInvitationsByGroup,
  handleDeleteInvitationsByGroup,
  handleReinvite,
} from './handlers/invitations';

export {
  createApiResponse,
  createErrorResponse,
  parseRequestBody,
  getQueryParam,
  getRouteParam,
  validateRequiredFields,
  sanitizeInput,
} from './utils';

export * from '@teamvortexsoftware/vortex-node-22-sdk';