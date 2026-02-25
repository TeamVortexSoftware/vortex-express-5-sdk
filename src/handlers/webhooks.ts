import { Request, Response, NextFunction } from 'express';
import { VortexWebhooks, WebhookHandlers } from '@teamvortexsoftware/vortex-node-22-sdk';

/**
 * Create an Express middleware that handles incoming Vortex webhook events.
 *
 * **Important:** This handler requires the raw request body for signature
 * verification. Use `express.raw({ type: 'application/json' })` on the
 * route, or configure a body parser that preserves the raw body.
 *
 * @param webhooks - A configured `VortexWebhooks` instance
 * @param handlers - Event handler configuration
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { VortexWebhooks } from '@teamvortexsoftware/vortex-node-22-sdk';
 * import { createVortexWebhookHandler } from '@teamvortexsoftware/vortex-express-5-sdk';
 *
 * const app = express();
 * const webhooks = new VortexWebhooks({ secret: process.env.VORTEX_WEBHOOK_SECRET! });
 *
 * app.post('/webhooks/vortex',
 *   express.raw({ type: 'application/json' }),
 *   createVortexWebhookHandler(webhooks, {
 *     on: {
 *       'invitation.accepted': async (event) => {
 *         await db.activateUser(event.data.targetEmail);
 *       },
 *     },
 *     onEvent: async (event) => {
 *       console.log(`Received ${event.type}`, event.data);
 *     },
 *     onAnalyticsEvent: async (event) => {
 *       await warehouse.ingest(event);
 *     },
 *   })
 * );
 * ```
 */
export function createVortexWebhookHandler(
  webhooks: VortexWebhooks,
  handlers: WebhookHandlers,
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, _next: NextFunction) => {
    const signatureHeader = req.headers['x-vortex-signature'];

    if (Array.isArray(signatureHeader)) {
      res.status(400).json({ error: 'Multiple X-Vortex-Signature headers are not allowed' });
      return;
    }

    const signature = signatureHeader;

    if (!signature) {
      res.status(401).json({ error: 'Missing X-Vortex-Signature header' });
      return;
    }

    // Require raw body for signature verification — fail fast if body was parsed
    let rawBody: string | Buffer;
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else {
      res.status(500).json({
        error:
          'Vortex webhook handler requires the raw request body. ' +
          'Configure express.raw({ type: "application/json" }) before this middleware.',
      });
      return;
    }

    try {
      const event = webhooks.constructEvent(rawBody, signature);
      await webhooks.handleEvent(event, handlers);
      res.status(200).json({ received: true });
    } catch (err) {
      // Note: if the error came from a handler (not signature verification),
      // handleEvent() already called onError before rethrowing.
      // We only call onError here for signature errors.
      const isSignatureError = (err as Error).name === 'VortexWebhookSignatureError';
      if (isSignatureError && handlers.onError) {
        handlers.onError(err as Error);
      }
      res.status(isSignatureError ? 401 : 500).json({
        error: isSignatureError ? 'Invalid signature' : 'Webhook handler error',
      });
    }
  };
}
