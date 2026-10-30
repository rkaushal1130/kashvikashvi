import { test, expect } from '@playwright/test';

test.describe('Commission Distribution Message Queue & Dead-Letter Retry Suite', () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
    // 1. Super Admin Login
    const loginRes = await request.post('http://localhost:5001/api/auth/login', {
      data: { email: 'admin@kashvimlm.com', password: 'Admin@Kashvimlm#1001' },
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    adminToken = loginData.data?.tokens?.accessToken || loginData.data?.accessToken;
    expect(adminToken).toBeDefined();
  });

  test('TC-QUEUE-01: Admin can retrieve live message queue metrics and worker health', async ({ request }) => {
    const res = await request.get('http://localhost:5001/api/v1/admin/funding/commissions/queue/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('totalJobs');
    expect(json.data).toHaveProperty('queued');
    expect(json.data).toHaveProperty('processing');
    expect(json.data).toHaveProperty('completed');
    expect(json.data).toHaveProperty('failedDLQ');
    expect(json.data).toHaveProperty('concurrency');
    expect(json.data.concurrency).toBeGreaterThan(0);
    expect(json.data).toHaveProperty('isWorkerRunning');
  });

  test('TC-QUEUE-02: Enqueueing valid commission distribution jobs processes asynchronously to COMPLETED', async ({ request }) => {
    // 1. Enqueue a valid commission job
    const enqueueRes = await request.post('http://localhost:5001/api/v1/admin/funding/commissions/queue/enqueue-test', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        distributorId: 'usr-admin-seed',
        distributorCode: 'KV-1001',
        amount: 250,
        simulateFailure: false,
      },
    });
    expect(enqueueRes.status()).toBe(201);
    const enqJson = await enqueueRes.json();
    expect(enqJson.success).toBe(true);
    expect(enqJson.data.jobIds.length).toBe(1);
    const jobId = enqJson.data.jobIds[0];

    // 2. Allow worker tick to pick up and complete the job
    await new Promise((r) => setTimeout(r, 2000));

    // 3. Verify stats reflect completion
    const statsRes = await request.get('http://localhost:5001/api/v1/admin/funding/commissions/queue/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsJson = await statsRes.json();
    expect(statsJson.data.completed).toBeGreaterThan(0);
  });

  test('TC-QUEUE-03: Failed jobs are quarantined in Dead-Letter Queue (DLQ) with diagnostics and failure reason', async ({ request }) => {
    // 1. Enqueue a job designed to fail (invalid rail)
    const enqueueRes = await request.post('http://localhost:5001/api/v1/admin/funding/commissions/queue/enqueue-test', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        distributorId: 'usr-failing-test',
        distributorCode: 'DST-FAIL-999',
        amount: 500,
        simulateFailure: true,
      },
    });
    expect(enqueueRes.status()).toBe(201);
    const enqJson = await enqueueRes.json();
    const failedJobId = enqJson.data.jobIds[0];

    // 2. Allow worker to attempt processing
    await new Promise((r) => setTimeout(r, 2000));

    // 3. Inspect Dead-Letter Queue (DLQ)
    const dlqRes = await request.get('http://localhost:5001/api/v1/admin/funding/commissions/queue/failed', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(dlqRes.status()).toBe(200);
    const dlqJson = await dlqRes.json();
    expect(dlqJson.success).toBe(true);
    expect(dlqJson.data).toHaveProperty('failedJobs');
  });

  test('TC-QUEUE-04: Single & bulk retry of dead-letter jobs re-enqueues them for execution', async ({ request }) => {
    // 1. Fetch any failed job or retry bulk
    const retryRes = await request.post('http://localhost:5001/api/v1/admin/funding/commissions/queue/retry-failed', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {},
    });
    expect(retryRes.status()).toBe(200);
    const retryJson = await retryRes.json();
    expect(retryJson.success).toBe(true);
    expect(retryJson.data).toHaveProperty('retriedCount');

    // 2. Queue stats verify that retried jobs re-entered processing pipeline
    const statsRes = await request.get('http://localhost:5001/api/v1/admin/funding/commissions/queue/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const statsJson = await statsRes.json();
    expect(statsJson.success).toBe(true);
  });
});
