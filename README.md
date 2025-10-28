# Vortex Express 5 SDK

Drop-in Express integration for Vortex invitations and JWT functionality. Get up and running in under 2 minutes!

## 🚀 Quick Start

```bash
npm install @teamvortexsoftware/vortex-express-5-sdk @teamvortexsoftware/vortex-react-provider
```

### Easy Integration (Recommended)

```typescript
import express from 'express';
import { createVortexRouter, configureVortex, createAllowAllAccessControl } from '@teamvortexsoftware/vortex-express-5-sdk';

const app = express();

// Configure Vortex
configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,

  // Required: How to authenticate users
  authenticateUser: async (req, res) => {
    const user = await getCurrentUser(req); // Your auth logic
    return user ? {
      userId: user.id,
      identifiers: [{ type: 'email', value: user.email }],
      groups: user.groups, // [{ type: 'team', groupId: '123', name: 'My Team' }]
    } : null;
  },

  // Simple: Allow all operations (customize for production)
  ...createAllowAllAccessControl(),
});

// Required middleware
app.use(express.json());

// Add Vortex routes
app.use('/api/vortex', createVortexRouter());

app.listen(3000);
```

That's it! Your Express app now has all Vortex API endpoints.

## ⚡ What You Get

- **JWT Authentication**: Secure user authentication with Vortex
- **Invitation Management**: Create, accept, and manage invitations
- **Full Node.js SDK Access**: All `@teamvortexsoftware/vortex-node-22-sdk` functionality
- **TypeScript Support**: Fully typed with IntelliSense
- **React Integration**: Works seamlessly with `@teamvortexsoftware/vortex-react-provider`

## 📚 API Endpoints

Your app automatically gets these API routes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vortex/jwt` | POST | Generate JWT for authenticated user |
| `/api/vortex/invitations` | GET | Get invitations by target (email/phone) |
| `/api/vortex/invitations/accept` | POST | Accept multiple invitations |
| `/api/vortex/invitations/:id` | GET/DELETE | Get or delete specific invitation |
| `/api/vortex/invitations/:id/reinvite` | POST | Resend invitation |
| `/api/vortex/invitations/by-group/:type/:id` | GET/DELETE | Group-based operations |

## 🛠️ Setup Options

### Option 1: Complete Router (Easiest)

```typescript
import express from 'express';
import { createVortexRouter } from '@teamvortexsoftware/vortex-express-5-sdk';

const app = express();
app.use(express.json()); // Required!
app.use('/api/vortex', createVortexRouter());
```

### Option 2: Manual Route Registration

```typescript
import express from 'express';
import { registerVortexRoutes } from '@teamvortexsoftware/vortex-express-5-sdk';

const app = express();
app.use(express.json()); // Required!

// Register with custom base path
registerVortexRoutes(app, '/api/v1/vortex');
```

### Option 3: Individual Route Handlers

```typescript
import express from 'express';
import { createVortexRoutes } from '@teamvortexsoftware/vortex-express-5-sdk';

const app = express();
app.use(express.json()); // Required!

const routes = createVortexRoutes();

// Register individual routes with full control
app.post('/api/vortex/jwt', routes.jwt);
app.get('/api/vortex/invitations', routes.invitations);
app.get('/api/vortex/invitations/:invitationId', routes.invitation.get);
app.delete('/api/vortex/invitations/:invitationId', routes.invitation.delete);
// ... etc
```

## ⚙️ Configuration

### 1. Environment Variables

Add to your `.env`:
```bash
VORTEX_API_KEY=your_api_key_here
```

### 2. Basic Configuration

```typescript
import { configureVortex, createAllowAllAccessControl } from '@teamvortexsoftware/vortex-express-5-sdk';

configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,

  // Required: How to authenticate users
  authenticateUser: async (req, res) => {
    const user = await getCurrentUser(req); // Your auth logic
    return user ? {
      userId: user.id,
      identifiers: [{ type: 'email', value: user.email }],
      groups: user.groups, // [{ type: 'team', groupId: '123', name: 'My Team' }]
    } : null;
  },

  // Simple: Allow all operations (customize for production)
  ...createAllowAllAccessControl(),
});
```

### 3. Lazy Configuration (Advanced)

Use this if your configuration depends on database connections or other async setup:

```typescript
import { configureVortexLazy } from '@teamvortexsoftware/vortex-express-5-sdk';

configureVortexLazy(async () => ({
  apiKey: process.env.VORTEX_API_KEY!,

  authenticateUser: async (req, res) => {
    // This can make database calls, etc.
    const user = await getUserFromDatabase(req);
    return user ? {
      userId: user.id,
      identifiers: [{ type: 'email', value: user.email }],
      groups: await getUserGroups(user.id),
    } : null;
  },

  ...createAllowAllAccessControl(),
}));
```

## 🔧 Production Security

For production apps, replace `createAllowAllAccessControl()` with proper authorization:

```typescript
configureVortex({
  apiKey: process.env.VORTEX_API_KEY!,
  authenticateUser: async (req, res) => { /* your auth */ },

  // Custom access control
  canDeleteInvitation: async (req, res, user, resource) => {
    return user?.role === 'admin'; // Only admins can delete
  },

  canAccessInvitationsByGroup: async (req, res, user, resource) => {
    return user?.groups.some(g =>
      g.type === resource?.groupType && g.groupId === resource?.groupId
    );
  },

  // ... other access control hooks
});
```

## 🎯 Frontend Integration

### React: Get User's JWT

```typescript
import { useVortexJWT } from '@teamvortexsoftware/vortex-react-provider';

function MyComponent() {
  const { jwt, isLoading } = useVortexJWT();

  if (isLoading) return <div>Loading...</div>;
  if (!jwt) return <div>Not authenticated</div>;

  return <div>Authenticated! JWT: {jwt.substring(0, 20)}...</div>;
}
```

### React: Setup Provider

```typescript
// In your app root
import { VortexProvider } from '@teamvortexsoftware/vortex-react-provider';

function App() {
  return (
    <VortexProvider config={{ apiBaseUrl: '/api/vortex' }}>
      {/* Your app */}
    </VortexProvider>
  );
}
```

### Manage Invitations

```typescript
// Get invitations
const response = await fetch('/api/vortex/invitations/by-group/team/my-team-id');
const { invitations } = await response.json();

// Delete invitation
await fetch(`/api/vortex/invitations/${invitationId}`, { method: 'DELETE' });
```

## 🔄 Comparison with Next.js SDK

| Feature | Express SDK | Next.js SDK |
|---------|-------------|-------------|
| **Setup** | `createVortexRouter()` | Multiple route files |
| **Routes** | Express Router | Next.js App Router |
| **Config** | Same API | Same API |
| **Access Control** | Same API | Same API |
| **Frontend Integration** | Same React Provider | Same React Provider |
| **Deployment** | Any Express host | Vercel/Next.js hosts |

## 📦 Direct SDK Usage

All Node.js SDK functionality is available:

```typescript
import { Vortex } from '@teamvortexsoftware/vortex-express-5-sdk';

// All Node.js SDK functionality is available
const vortex = new Vortex(process.env.VORTEX_API_KEY!);
const invitations = await vortex.getInvitationsByGroup('team', 'team-123');
```

## 🛠️ Advanced: Custom Handlers

Need custom logic? Use individual handlers:

```typescript
import express from 'express';
import { handleGetInvitation, createErrorResponse } from '@teamvortexsoftware/vortex-express-5-sdk';

const app = express();

app.get('/api/custom-invitation/:invitationId', async (req, res) => {
  // Add custom validation
  const user = await validateUser(req);
  if (!user.isAdmin) {
    return createErrorResponse(res, 'Admin required', 403);
  }

  // Use SDK handler
  return handleGetInvitation(req, res);
});
```

## 📋 Requirements

- **Express**: 5.0.0 or higher
- **Node.js**: 18.0.0 or higher
- **TypeScript**: 5.0.0 or higher (for TypeScript projects)

## 🆘 Troubleshooting

### Common Issues

**"Request body is empty or not parsed"**
- Make sure you're using `app.use(express.json())` before registering Vortex routes

**Configuration errors**
- Ensure you're calling `configureVortex()` or `configureVortexLazy()` before starting your server
- Check that your `.env` has `VORTEX_API_KEY`

**Authentication Issues**
- Verify your `authenticateUser` function returns the correct format
- Check that your authentication middleware is working
- Make sure JWT requests include authentication cookies/headers

**TypeScript Errors**
- All types are exported from the main package
- Resource parameters are fully typed for access control hooks

## 📦 What's Included

This SDK re-exports everything from `@teamvortexsoftware/vortex-node-22-sdk`, so you get:

- ✅ `Vortex` class for direct API access
- ✅ All invitation management methods
- ✅ JWT generation utilities
- ✅ TypeScript definitions
- ✅ Express optimized route handlers

## 🔗 Links

- [Node.js SDK Documentation](../vortex-node-22-sdk/README.md)
- [Next.js SDK Documentation](../vortex-nextjs-15-sdk/README.md)
- [React Provider Documentation](../vortex-react-provider/README.md)

---

**Need help?** Open an issue or check the Next.js SDK example implementation for reference patterns.