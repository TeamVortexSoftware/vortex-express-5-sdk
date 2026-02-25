import crypto from 'node:crypto';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createVortexWebhookHandler } from '../src/handlers/webhooks';
import { VortexWebhooks, WebhookHandlers, VortexWebhookEvent } from '@teamvortexsoftware/vortex-node-22-sdk';

const TEST_SECRET = 'whsec_test_secret';

function sign(payload: string): string {
  return crypto.createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
}

const sampleEvent: VortexWebhookEvent = {
  id: 'evt_1',
  type: 'invitation.accepted',
  timestamp: '2026-02-25T12:00:00Z',
  accountId: 'acc_1',
  environmentId: null,
  sourceTable: 'invitations',
  operation: 'update',
  data: { targetEmail: 'user@test.com' },
};

function mockReq(overrides: Record<string, any> = {}) {
  const body = overrides.body ?? Buffer.from(JSON.stringify(sampleEvent));
  return {
    headers: overrides.headers ?? { 'x-vortex-signature': sign(typeof body === 'string' ? body : body.toString()) },
    body,
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createVortexWebhookHandler (Express)', () => {
  let webhooks: VortexWebhooks;

  beforeEach(() => {
    webhooks = new VortexWebhooks({ secret: TEST_SECRET });
  });

  it('returns 200 and calls handler on valid request', async () => {
    const calls: string[] = [];
    const handlers: WebhookHandlers = {
      on: { 'invitation.accepted': async () => { calls.push('accepted'); } },
    };
    const handler = createVortexWebhookHandler(webhooks, handlers);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(calls).toEqual(['accepted']);
  });

  it('returns 401 when signature header is missing', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockReq({ headers: {} });
    const res = mockRes();
    await handler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when multiple signature headers are present', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockReq({ headers: { 'x-vortex-signature': ['sig1', 'sig2'] } });
    const res = mockRes();
    await handler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 for invalid signature', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockReq({ headers: { 'x-vortex-signature': 'bad_sig' } });
    const res = mockRes();
    await handler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 500 when body is parsed JSON object (not raw)', async () => {
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockReq({ body: { id: 'evt_1' }, headers: { 'x-vortex-signature': 'anything' } });
    const res = mockRes();
    await handler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('raw request body'),
    }));
  });

  it('calls onError when handler throws', async () => {
    const errors: Error[] = [];
    const handlers: WebhookHandlers = {
      onEvent: async () => { throw new Error('boom'); },
      onError: (err) => { errors.push(err); },
    };
    const handler = createVortexWebhookHandler(webhooks, handlers);
    const req = mockReq();
    const res = mockRes();
    await handler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(errors).toHaveLength(1);
  });

  it('works with string body', async () => {
    const body = JSON.stringify(sampleEvent);
    const handler = createVortexWebhookHandler(webhooks, {});
    const req = mockReq({
      body,
      headers: { 'x-vortex-signature': sign(body) },
    });
    const res = mockRes();
    await handler(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
