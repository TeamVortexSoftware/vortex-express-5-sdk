import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { createVortexWebhookHandler } from '../../src/handlers/webhooks';
import { VortexWebhooks, VortexWebhookEvent } from '@teamvortexsoftware/vortex-node-22-sdk';
import crypto from 'node:crypto';

const TEST_SECRET = 'whsec_test_secret_key_1234567890';

function sign(payload: string, secret: string = TEST_SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

const sampleWebhookEvent: VortexWebhookEvent = {
  id: 'evt_123',
  type: 'invitation.accepted',
  timestamp: '2026-02-25T12:00:00Z',
  accountId: 'acc_456',
  environmentId: 'env_789',
  sourceTable: 'invitations',
  operation: 'update',
  data: {
    invitationId: 'inv_abc',
    targetEmail: 'user@example.com',
  },
};

describe('createVortexWebhookHandler', () => {
  let webhooks: VortexWebhooks;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock<NextFunction>;

  beforeEach(() => {
    webhooks = new VortexWebhooks({ secret: TEST_SECRET });
    
    mockReq = {
      headers: {},
      body: '',
    };

    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };

    mockNext = jest.fn() as any;
  });

  it('returns 401 when X-Vortex-Signature header is missing', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing X-Vortex-Signature header' });
  });

  it('returns 400 when X-Vortex-Signature header is an array', async () => {
    mockReq.headers = {
      'x-vortex-signature': ['sig1', 'sig2'] as any,
    };
    mockReq.body = Buffer.from(JSON.stringify(sampleWebhookEvent));

    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Multiple X-Vortex-Signature headers are not allowed' });
  });

  it('returns 500 when body is not string or Buffer (JSON parsed)', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockReq.headers = {
      'x-vortex-signature': sign(payload),
    };
    mockReq.body = JSON.parse(payload); // Parsed object, not raw

    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('raw request body'),
      })
    );
  });

  it('returns 401 when signature is invalid', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockReq.headers = {
      'x-vortex-signature': 'invalid_signature',
    };
    mockReq.body = Buffer.from(payload);

    const handler = createVortexWebhookHandler(webhooks, {});
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('successfully processes valid webhook with Buffer body', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockReq.headers = {
      'x-vortex-signature': sign(payload),
    };
    mockReq.body = Buffer.from(payload);

    const onEventMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onEvent: onEventMock,
    });
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(onEventMock).toHaveBeenCalledWith(sampleWebhookEvent);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
  });

  it('successfully processes valid webhook with string body', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockReq.headers = {
      'x-vortex-signature': sign(payload),
    };
    mockReq.body = payload; // String body

    const onEventMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onEvent: onEventMock,
    });
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(onEventMock).toHaveBeenCalledWith(sampleWebhookEvent);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ received: true });
  });

  it('calls type-specific handler when provided', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockReq.headers = {
      'x-vortex-signature': sign(payload),
    };
    mockReq.body = Buffer.from(payload);

    const typeHandlerMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      on: {
        'invitation.accepted': typeHandlerMock,
      },
    });
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(typeHandlerMock).toHaveBeenCalledWith(sampleWebhookEvent);
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  it('calls onError handler when handler throws', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockReq.headers = {
      'x-vortex-signature': sign(payload),
    };
    mockReq.body = Buffer.from(payload);

    const testError = new Error('Handler error');
    const onErrorMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onEvent: jest.fn().mockRejectedValue(testError),
      onError: onErrorMock,
    });
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(onErrorMock).toHaveBeenCalledWith(testError);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Webhook handler error' });
  });

  it('calls onError handler when signature verification fails', async () => {
    const payload = JSON.stringify(sampleWebhookEvent);
    mockReq.headers = {
      'x-vortex-signature': 'invalid_signature',
    };
    mockReq.body = Buffer.from(payload);

    const onErrorMock = jest.fn();
    const handler = createVortexWebhookHandler(webhooks, {
      onError: onErrorMock,
    });
    
    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(onErrorMock).toHaveBeenCalled();
    const error = (onErrorMock.mock.calls[0] as any)[0];
    expect(error.name).toBe('VortexWebhookSignatureError');
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});
