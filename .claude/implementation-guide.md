# Vortex Express 5 Integration Guide

This guide provides step-by-step instructions for integrating Vortex into an Express 5 application using the `@teamvortexsoftware/vortex-express-5-sdk`.

## SDK Information

- **Package**: `@teamvortexsoftware/vortex-express-5-sdk`
- **Depends on**: `@teamvortexsoftware/vortex-node-22-sdk`
- **Requires**: Express 5.0.0+, Node.js 18.0.0+
- **Type**: Backend SDK with drop-in Express Router

## Expected Input Context

This guide expects to receive the following context from the orchestrator:

### Integration Contract
```yaml
Integration Contract:
  API Endpoints:
    Prefix: /api/v1
    JWT: POST {prefix}/vortex/jwt
    Get Invitations: GET {prefix}/vortex/invitations?type={type}&value={value}
    Get Invitation: GET {prefix}/vortex/invitations/:id
    Accept Invitations: POST {prefix}/vortex/invitations/accept
  Scope:
    Entity: "workspace"
    Type: "workspace"
    ID Field: "workspace.id"
  File Paths:
    Backend:
      Vortex Routes: src/routes/vortex.ts (or wherever routes are registered)
      Main App: src/app.ts or src/index.ts
  Authentication:
    Pattern: "JWT Bearer token" (or session-based, etc.)
    User Extraction: "req.user" (or custom middleware)
  Database:
    ORM: "Prisma" | "TypeORM" | "Sequelize" | "Knex" | "Raw SQL"
    User Model: users table/model
    Membership Model: workspaceMembers table/model (or equivalent)
```

### Discovery Data
- Backend technology stack (Express version, TypeScript/JavaScript)
- Database ORM/library
- Authentication middleware in use
- Existing route structure
- Environment variable management approach

## Implementation Overview

The Express 5 SDK provides three integration methods:

1. **Drop-in Router** (Recommended): `createVortexRouter()` - Complete router with all endpoints
2. **Manual Registration**: `registerVortexRoutes(app, basePath)` - Register routes individually
3. **Individual Handlers**: `createVortexRoutes()` - Access route handlers directly

All methods require configuration via `configureVortex()` to connect to your authentication and database layer.

## Critical Express 5 Specifics

### Key Patterns
- **Lazy Initialization**: Always configure Vortex BEFORE registering routes
- **Middleware Order**: `express.json()` must be registered before Vortex routes
- **Authentication Hook**: `authenticateUser` extracts user from request
- **Access Control**: Optional hooks for authorization (`canGetJwt`, `canAcceptInvitation`, etc.)
- **New User Format**: `{ userId, userEmail, adminScopes }` (simplified from legacy format)

### Router Pattern (Recommended)
```typescript
import { configureVortex, createVortexRouter } from '@teamvortexsoftware/vortex-express-5-sdk';

// 1. Configure
configureVortex({
  authenticateUser: async (req) => ({
    userId: req.user.id,
    userEmail: req.user.email,
    adminScopes: req.user.isAdmin ? ['autojoin'] : undefined
  })
});

// 2. Create router
const vortexRouter = createVortexRouter();

// 3. Mount at prefix
app.use('/api/v1/vortex', vortexRouter);
```

## Step-by-Step Implementation

### Step 1: Install SDK

```bash
npm install @teamvortexsoftware/vortex-express-5-sdk
# or
yarn add @teamvortexsoftware/vortex-express-5-sdk
# or
pnpm add @teamvortexsoftware/vortex-express-5-sdk
```

### Step 2: Set Up Environment Variables

Add to your `.env` file:

```bash
VORTEX_API_KEY=VRTX.your-api-key-here.secret
```

**IMPORTANT**: Never commit your API key to version control.

### Step 3: Configure Vortex

Create or update your Vortex configuration file (e.g., `src/lib/vortex.ts`):

```typescript
import { configureVortex } from '@teamvortexsoftware/vortex-express-5-sdk';

// Configure Vortex with your authentication logic
configureVortex({
  // Required: Extract authenticated user from request
  authenticateUser: async (req) => {
    // Adjust based on your authentication middleware
    // Examples:
    // - Express session: req.session.user
    // - JWT middleware: req.user (from passport, express-jwt, etc.)
    // - Custom auth: req.auth

    const user = req.user; // Adjust to your auth pattern

    if (!user) {
      return null; // Not authenticated
    }

    // Return new simplified format
    return {
      userId: user.id,           // Your user's unique ID
      userEmail: user.email,     // User's email address
      adminScopes: user.isAdmin ? ['autojoin'] : undefined  // Optional admin scopes
    };
  },

  // Optional: Access control hooks
  // If not provided, all authenticated users can access all endpoints
  accessControl: {
    canGetJwt: async (req, user) => {
      // Allow all authenticated users to get JWT
      return true;
    },
    canAcceptInvitation: async (req, user, invitationIds) => {
      // Add custom authorization logic here
      // Example: check if user is accepting their own invitation
      return true;
    },
    canGetInvitation: async (req, user, invitationId) => {
      // Add custom authorization logic
      return true;
    },
    canRevokeInvitation: async (req, user, invitationId) => {
      // Example: only admins can revoke
      return user.adminScopes?.includes('autojoin') || false;
    },
    // ... other hooks as needed
  }
});
```

### Step 4: Register Vortex Routes

**Option A: Drop-in Router (Recommended)**

In your main app file (e.g., `src/app.ts` or `src/index.ts`):

```typescript
import express from 'express';
import { createVortexRouter } from '@teamvortexsoftware/vortex-express-5-sdk';
import './lib/vortex'; // Import configuration

const app = express();

// IMPORTANT: JSON body parser must come before Vortex routes
app.use(express.json());

// Mount Vortex router at the prefix from the integration contract
app.use('/api/v1/vortex', createVortexRouter());

// Your other routes...
```

**Option B: Manual Route Registration**

```typescript
import express from 'express';
import { registerVortexRoutes } from '@teamvortexsoftware/vortex-express-5-sdk';
import './lib/vortex';

const app = express();
app.use(express.json());

// Register routes with base path
registerVortexRoutes(app, '/api/v1/vortex');
```

**Option C: Individual Route Handlers (Advanced)**

```typescript
import express from 'express';
import { createVortexRoutes } from '@teamvortexsoftware/vortex-express-5-sdk';
import './lib/vortex';

const app = express();
app.use(express.json());

const routes = createVortexRoutes();

// Register individual handlers
app.post('/api/v1/vortex/jwt', routes.getJwt);
app.get('/api/v1/vortex/invitations/:invitationId', routes.getInvitation);
app.post('/api/v1/vortex/invitations/accept', routes.acceptInvitations);
app.delete('/api/v1/vortex/invitations/:invitationId', routes.revokeInvitation);
app.post('/api/v1/vortex/invitations/:invitationId/reinvite', routes.reinviteUser);
app.get('/api/v1/vortex/invitations/by-group/:groupType/:groupId', routes.getInvitationsByGroup);
app.delete('/api/v1/vortex/invitations/by-group/:groupType/:groupId', routes.deleteInvitationsByGroup);
```

### Step 5: Implement Accept Invitations Endpoint (CRITICAL)

The accept invitations endpoint requires custom business logic to add users to your database. You MUST override this endpoint:

```typescript
import express from 'express';
import { createVortexRouter } from '@teamvortexsoftware/vortex-express-5-sdk';
import { VortexClient } from '@teamvortexsoftware/vortex-node-22-sdk';
import './lib/vortex';

const app = express();
app.use(express.json());

const vortexRouter = createVortexRouter();

// Create base Vortex router
const router = express.Router();

// Mount Vortex routes
router.use(vortexRouter);

// Override accept invitations endpoint with custom logic
router.post('/invitations/accept', async (req, res, next) => {
  try {
    const { invitationIds, target } = req.body;

    // 1. Extract authenticated user
    const user = req.user; // Adjust based on your auth middleware
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // 2. Accept invitation via Vortex API
    const vortex = new VortexClient(process.env.VORTEX_API_KEY!);
    const result = await vortex.acceptInvitations(invitationIds, target);

    // 3. Add user to your database for each group
    // Adjust based on your database ORM/library

    // Example with Prisma:
    for (const group of result.groups) {
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: group.groupId, // Customer's group ID
          role: 'member',
          joinedAt: new Date()
        }
      });
    }

    // Example with TypeORM:
    // for (const group of result.groups) {
    //   const member = workspaceMemberRepository.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    //   await workspaceMemberRepository.save(member);
    // }

    // Example with Sequelize:
    // for (const group of result.groups) {
    //   await WorkspaceMember.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    // }

    // Example with Raw SQL:
    // for (const group of result.groups) {
    //   await db.query(
    //     'INSERT INTO workspace_members (user_id, workspace_id, role, joined_at) VALUES (?, ?, ?, ?)',
    //     [user.id, group.groupId, 'member', new Date()]
    //   );
    // }

    // 4. Return success
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Mount at prefix
app.use('/api/v1/vortex', router);
```

### Step 6: Add CORS Configuration (If Needed)

If your frontend is on a different domain:

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

### Step 7: Verify Authentication Middleware

Ensure your authentication middleware runs BEFORE Vortex routes:

```typescript
import express from 'express';
import { createVortexRouter } from '@teamvortexsoftware/vortex-express-5-sdk';
import './lib/vortex';
import { authMiddleware } from './middleware/auth'; // Your auth middleware

const app = express();
app.use(express.json());

// Authentication middleware MUST run before Vortex routes
app.use(authMiddleware);

app.use('/api/v1/vortex', createVortexRouter());
```

## Build and Validation

### Build Your Application

```bash
# TypeScript projects
npm run build
# or
tsc

# JavaScript projects - no build needed
```

### Test the Integration

Start your server and test each endpoint:

```bash
# Start server
npm start

# Test JWT endpoint
curl -X POST http://localhost:3000/api/v1/vortex/jwt \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Test get invitations by target
curl -X GET "http://localhost:3000/api/v1/vortex/invitations?type=email&value=user@example.com" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Test get invitation by ID
curl -X GET http://localhost:3000/api/v1/vortex/invitations/INVITATION_ID \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Test accept invitations
curl -X POST http://localhost:3000/api/v1/vortex/invitations/accept \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invitationIds": ["invitation-id-1"],
    "target": { "type": "email", "value": "user@example.com" }
  }'
```

### Validation Checklist

- [ ] SDK installed successfully
- [ ] Environment variable `VORTEX_API_KEY` is set
- [ ] `configureVortex()` is called before routes are registered
- [ ] `express.json()` middleware is registered before Vortex routes
- [ ] Vortex routes are mounted at the correct prefix
- [ ] JWT endpoint returns valid JWT
- [ ] Accept invitations endpoint adds users to database
- [ ] Authentication middleware protects all Vortex endpoints
- [ ] CORS is configured (if frontend on different domain)

## Implementation Report

After completing the integration, provide this summary:

```markdown
## Express 5 Integration Complete

### Files Modified/Created
- `src/lib/vortex.ts` - Vortex configuration with authenticateUser hook
- `src/app.ts` - Mounted Vortex router at /api/v1/vortex
- `.env` - Added VORTEX_API_KEY environment variable

### Endpoints Registered
- POST /api/v1/vortex/jwt - Generate JWT for authenticated user
- GET /api/v1/vortex/invitations - Get invitations by target (query: type, value)
- GET /api/v1/vortex/invitations/:id - Get invitation by ID
- POST /api/v1/vortex/invitations/accept - Accept invitations (custom logic)
- DELETE /api/v1/vortex/invitations/:id - Revoke invitation
- POST /api/v1/vortex/invitations/:id/reinvite - Resend invitation
- GET /api/v1/vortex/invitations/by-group/:type/:id - Get invitations for group
- DELETE /api/v1/vortex/invitations/by-group/:type/:id - Delete invitations for group

### Database Integration
- ORM: [Prisma/TypeORM/Sequelize/etc.]
- Accept invitations adds users to: [table name]
- Group association field: [workspaceId/teamId/etc.]

### Authentication
- Pattern: [JWT Bearer/Session/Custom]
- User extraction: req.user
- Admin scope detection: user.isAdmin

### Next Steps for Frontend
The backend now exposes these endpoints for the frontend to consume:
1. Call POST /api/v1/vortex/jwt to get JWT for Vortex widget
2. Pass JWT to Vortex widget component
3. Widget will handle invitation sending
4. Accept invitations via POST /api/v1/vortex/invitations/accept
```

## Common Issues and Solutions

### Issue: "Cannot find module '@teamvortexsoftware/vortex-express-5-sdk'"
**Solution**: Ensure the SDK is installed and TypeScript can resolve it:
```bash
npm install @teamvortexsoftware/vortex-express-5-sdk
# If using TypeScript, restart your editor/TS server
```

### Issue: "configureVortex is not a function"
**Solution**: Make sure you're importing from the correct package and that configuration is called before route registration:
```typescript
import { configureVortex } from '@teamvortexsoftware/vortex-express-5-sdk';
```

### Issue: "req.user is undefined in authenticateUser"
**Solution**: Ensure your authentication middleware runs BEFORE Vortex routes:
```typescript
app.use(authMiddleware); // Must come first
app.use('/api/v1/vortex', createVortexRouter());
```

### Issue: "Cannot read property 'userId' of null"
**Solution**: `authenticateUser` returned null. Ensure the user is authenticated before accessing Vortex endpoints.

### Issue: "Unexpected token in JSON"
**Solution**: Ensure `express.json()` middleware is registered before Vortex routes:
```typescript
app.use(express.json()); // Must come before Vortex routes
app.use('/api/v1/vortex', createVortexRouter());
```

### Issue: "CORS error when calling from frontend"
**Solution**: Add CORS middleware:
```bash
npm install cors
```
```typescript
import cors from 'cors';
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```

### Issue: "Accept invitations succeeds but user not added to database"
**Solution**: You must override the accept invitations endpoint with custom database logic (see Step 5).

## Best Practices

### 1. Environment Variables
Store sensitive configuration in `.env`:
```bash
VORTEX_API_KEY=VRTX.your-key.secret
NODE_ENV=production
FRONTEND_URL=https://your-app.com
```

### 2. Error Handling
Add error handling middleware after Vortex routes:
```typescript
app.use('/api/v1/vortex', createVortexRouter());

app.use((err, req, res, next) => {
  console.error('Vortex error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    code: err.code || 'INTERNAL_ERROR'
  });
});
```

### 3. Admin Scopes
Only grant `autojoin` scope to administrators:
```typescript
configureVortex({
  authenticateUser: async (req) => {
    const user = req.user;
    return {
      userId: user.id,
      userEmail: user.email,
      adminScopes: user.role === 'admin' ? ['autojoin'] : undefined
    };
  }
});
```

### 4. Database Transactions
Wrap database operations in transactions:
```typescript
// Prisma example
await prisma.$transaction(async (tx) => {
  for (const group of result.groups) {
    await tx.workspaceMember.create({
      data: { userId: user.id, workspaceId: group.groupId, role: 'member' }
    });
  }
});
```

### 5. Logging
Add request logging:
```typescript
app.use('/api/v1/vortex', (req, res, next) => {
  console.log(`[Vortex] ${req.method} ${req.path}`);
  next();
});
```

### 6. Rate Limiting
Add rate limiting to prevent abuse:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/v1/vortex', limiter);
```

## Additional Resources

- [Express 5 SDK Documentation](https://docs.vortexsoftware.com/sdks/express-5)
- [Node.js SDK Documentation](https://docs.vortexsoftware.com/sdks/node-22)
- [Vortex API Reference](https://api.vortexsoftware.com/api)
- [Integration Examples](https://github.com/teamvortexsoftware/vortex-examples)

## Support

For questions or issues:
- GitHub Issues: https://github.com/teamvortexsoftware/vortex-express-5-sdk/issues
- Email: support@vortexsoftware.com
- Documentation: https://docs.vortexsoftware.com
