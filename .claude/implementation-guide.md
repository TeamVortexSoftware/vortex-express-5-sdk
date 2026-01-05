# Vortex Express 5 Implementation Guide

**Package:** `@teamvortexsoftware/vortex-express-5-sdk`
**Depends on:** `@teamvortexsoftware/vortex-node-22-sdk`
**Requires:** Express 5.0.0+, Node.js 18.0.0+

## Prerequisites
From integration contract you need: API endpoint prefix, scope entity, authentication pattern
From discovery data you need: Auth middleware pattern, database ORM, route structure

## Key Facts
- Configure Vortex BEFORE registering routes
- `express.json()` must be registered before Vortex routes
- Auth middleware must run before Vortex routes
- Accept invitations endpoint requires custom database logic (must override)
- New simplified user format: `{ userId, userEmail, adminScopes }`

---

## Step 1: Install

```bash
npm install @teamvortexsoftware/vortex-express-5-sdk
# or
pnpm add @teamvortexsoftware/vortex-express-5-sdk
```

---

## Step 2: Set Environment Variable

Add to `.env`:

```bash
VORTEX_API_KEY=VRTX.your-api-key-here.secret
```

**Never commit API key to version control.**

---

## Step 3: Configure Vortex

Create `src/lib/vortex.ts` (or similar):

```typescript
import { configureVortex } from '@teamvortexsoftware/vortex-express-5-sdk';

configureVortex({
  // Required: Extract authenticated user from request
  authenticateUser: async (req) => {
    const user = req.user; // Adapt to your auth middleware

    if (!user) {
      return null; // Not authenticated
    }

    return {
      userId: user.id,
      userEmail: user.email,
      adminScopes: user.isAdmin ? ['autojoin'] : undefined
    };
  },

  // Optional: Access control hooks
  accessControl: {
    canGetJwt: async (req, user) => true,
    canAcceptInvitation: async (req, user, invitationIds) => true,
    canGetInvitation: async (req, user, invitationId) => true,
    canRevokeInvitation: async (req, user, invitationId) => {
      return user.adminScopes?.includes('autojoin') || false;
    },
  }
});
```

**Adapt to their patterns:**
- Match their auth middleware (req.user, req.session.user, req.auth, etc.)
- Match their user ID field (user.id, user._id, user.userId, etc.)
- Match their admin role check (user.isAdmin, user.role === 'admin', etc.)

---

## Step 4: Register Routes and Override Accept Endpoint

In main app file (e.g., `src/app.ts` or `src/index.ts`):

```typescript
import express from 'express';
import { createVortexRouter } from '@teamvortexsoftware/vortex-express-5-sdk';
import { VortexClient } from '@teamvortexsoftware/vortex-node-22-sdk';
import './lib/vortex'; // Import configuration
import { authMiddleware } from './middleware/auth'; // Your auth

const app = express();

// CRITICAL: Correct order
app.use(express.json());           // 1. JSON parser first
app.use(authMiddleware);            // 2. Auth middleware second

// Create router with custom accept endpoint
const router = express.Router();

// Mount base Vortex routes (jwt, get, revoke, etc.)
router.use(createVortexRouter());

// Override accept invitations with custom database logic
router.post('/invitations/accept', async (req, res, next) => {
  try {
    const { invitationIds, user: acceptUser } = req.body;
    const user = req.user; // Adapt

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Accept via Vortex API
    const vortex = new VortexClient(process.env.VORTEX_API_KEY!);
    const result = await vortex.acceptInvitations(invitationIds, acceptUser);

    // Add user to database - adapt to your ORM
    // Prisma example:
    for (const group of result.groups) {
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: group.groupId, // Adapt field names
          role: 'member',
          joinedAt: new Date()
        }
      });
    }

    // TypeORM example:
    // for (const group of result.groups) {
    //   const member = workspaceMemberRepository.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    //   await workspaceMemberRepository.save(member);
    // }

    // Sequelize example:
    // for (const group of result.groups) {
    //   await WorkspaceMember.create({
    //     userId: user.id,
    //     workspaceId: group.groupId,
    //     role: 'member',
    //     joinedAt: new Date()
    //   });
    // }

    // Raw SQL example:
    // for (const group of result.groups) {
    //   await db.query(
    //     'INSERT INTO workspace_members (user_id, workspace_id, role, joined_at) VALUES (?, ?, ?, ?)',
    //     [user.id, group.groupId, 'member', new Date()]
    //   );
    // }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Mount at prefix from integration contract
app.use('/api/v1/vortex', router); // Adapt prefix

// Your other routes...

export default app;
```

**Critical - Adapt database logic:**
- Use their actual table/model names (from discovery)
- Use their actual column/field names
- Use their database ORM/library pattern
- Handle duplicate memberships if needed

---

## Step 5: Add CORS (If Needed)

If frontend on different domain:

```typescript
import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

---

## Step 6: Build and Test

```bash
# TypeScript projects
npm run build

# Start server
npm start

# Test JWT endpoint
curl -X POST http://localhost:3000/api/v1/vortex/jwt \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

Expected response:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Common Errors

**"Cannot find module vortex-express-5-sdk"** → Run `npm install @teamvortexsoftware/vortex-express-5-sdk`

**"req.user is undefined"** → Ensure auth middleware runs before Vortex routes

**"Unexpected token in JSON"** → Ensure `express.json()` before Vortex routes

**"User not added to database"** → Must override accept endpoint with custom DB logic (see Step 4)

**"configureVortex is not a function"** → Import configuration file before using router

**CORS errors** → Install and configure cors: `npm install cors`

---

## After Implementation Report

List files created/modified:
- Configuration: src/lib/vortex.ts
- Routes: src/app.ts (mounted Vortex router)
- Environment: .env (VORTEX_API_KEY)
- Database: Accept endpoint creates memberships in [table name]

Confirm:
- `configureVortex()` called before routes registered
- Vortex router mounted at correct prefix
- Accept invitations endpoint overridden with DB logic
- JWT endpoint returns valid JWT
- Auth middleware runs before Vortex routes
- Build succeeds

## Endpoints Registered

All endpoints mounted at prefix (e.g., `/api/v1/vortex`):
- `POST /jwt` - Generate JWT for authenticated user
- `GET /invitations/:id` - Get invitation by ID
- `POST /invitations/accept` - Accept invitations (custom DB logic)
- `DELETE /invitations/:id` - Revoke invitation
- `POST /invitations/:id/reinvite` - Resend invitation
- `GET /invitations/by-group/:type/:id` - Get invitations for group
- `DELETE /invitations/by-group/:type/:id` - Delete invitations for group
