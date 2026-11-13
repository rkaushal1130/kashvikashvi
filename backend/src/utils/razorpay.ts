import { env } from '../config/env';
import { AppError } from './appError';

/**
 * Razorpay Checkout (Standard Payment Gateway) helpers.
 *
 * Credentials come ONLY from environment variables (backend/.env) — never from
 * source code and never from the browser. The key SECRET must never leave the
 * server; the key ID is public by design (Razorpay Checkout needs it) and is
 * handed to the frontend through API responses, not hardcoded in the UI.
 */
const RAZORPAY_API = 'https://api.razorpay.com/v1';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export function getRazorpayCredentials(): RazorpayCredentials {
  return {
    keyId: (process.env.RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID || env.FUNDING_PROVIDER_KEY_ID || '').trim(),
    keySecret: (
      process.env.RAZORPAY_KEY_SECRET ||
      env.RAZORPAY_KEY_SECRET ||
      env.FUNDING_PROVIDER_KEY_SECRET ||
      ''
    ).trim(),
    webhookSecret: (
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      env.RAZORPAY_WEBHOOK_SECRET ||
      env.FUNDING_PROVIDER_WEBHOOK_SECRET ||
      ''
    ).trim(),
  };
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = getRazorpayCredentials();
  return Boolean(keyId && keySecret && !keyId.includes('your_key_id'));
}

/** Throws a 503 if the gateway is not configured, so callers never open Checkout without a real order. */
export function requireRazorpayCredentials(): RazorpayCredentials {
  const creds = getRazorpayCredentials();
  if (!isRazorpayConfigured()) {
    throw new AppError(
      'Payment gateway is not configured on the server (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).',
      503,
      'PAYMENT_GATEWAY_NOT_CONFIGURED'
    );
  }
  return creds;
}

async function razorpayRequest<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const { keyId, keySecret } = requireRazorpayCredentials();
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const reason = body?.error?.description || body?.raw || `HTTP ${res.status}`;
    throw new AppError(`Razorpay API error: ${reason}`, 502, 'PAYMENT_GATEWAY_ERROR');
  }
  return body as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number; // paise
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method?: string;
  acquirer_data?: Record<string, any>;
  created_at?: number;
}

/** Creates a real Razorpay order (amount in rupees). */
export async function createRazorpayOrder(params: {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const amountInPaise = Math.round(Number(params.amount) * 100);
  if (!Number.isFinite(amountInPaise) || amountInPaise < 100) {
    throw AppError.badRequest('Payment amount must be at least ₹1.00', 'INVALID_AMOUNT');
  }
  return razorpayRequest<RazorpayOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: amountInPaise,
      currency: params.currency || 'INR',
      receipt: params.receipt.slice(0, 40),
      notes: params.notes || {},
    }),
  });
}

/** Lists all payments attempted against a Razorpay order. */
export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  const body = await razorpayRequest<{ items: RazorpayPayment[] }>(
    `/orders/${encodeURIComponent(orderId)}/payments`
  );
  return body?.items || [];
}
