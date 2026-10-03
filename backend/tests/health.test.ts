/**
 * Health Check Foundation Test
 * Verifies that the Express application properly responds to GET /api/v1/health
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('GET /api/v1/health', () => {
  it('should respond with 200 OK and healthy status', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('healthy');
  });
});
