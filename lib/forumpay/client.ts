import { v4 as uuidv4 } from 'uuid';

export interface ForumPayConfig {
  apiUrl: string;
  apiUser: string;
  apiSecret: string;
  mode: 'mock' | 'live';
}

export interface PaymentRequest {
  amount: string;
  currency: string;
  orderId: string;
  payerId?: string;
}

export interface PaymentResponse {
  payment_id: string;
  address: string;
  amount: string;
  currency: string;
  reference_no: string;
  status: string;
  inserted: string;
}

export class ForumPayClient {
  private config: ForumPayConfig;

  constructor() {
    this.config = {
      apiUrl: process.env.FORUMPAY_API_URL || 'https://api.forumpay.com/v1',
      apiUser: process.env.FORUMPAY_API_USER || '',
      apiSecret: process.env.FORUMPAY_API_SECRET || '',
      mode: (process.env.FORUMPAY_MODE as 'mock' | 'live') || 'mock'
    };
  }

  async startPayment(req: PaymentRequest): Promise<PaymentResponse> {
    if (this.config.mode === 'mock') {
      return this.mockStartPayment(req);
    }

    if (!this.config.apiUser || !this.config.apiSecret) {
      console.warn("ForumPay credentials missing in LIVE mode. Falling back to mock.");
      return this.mockStartPayment(req);
    }

    // Basic Basic Auth header generation
    const auth = Buffer.from(`${this.config.apiUser}:${this.config.apiSecret}`).toString('base64');

    const response = await fetch(`${this.config.apiUrl}/payments/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: req.amount,
        currency: req.currency,
        reference_no: req.orderId,
        payer_id: req.payerId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ForumPay API Error: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  async checkStatus(paymentId: string): Promise<PaymentResponse> {
    if (this.config.mode === 'mock') {
      return {
        payment_id: paymentId,
        address: '0xMock...',
        amount: '0.0', // details not stored in mock client
        currency: 'ETH',
        reference_no: 'ref_123',
        status: 'confirmed', // Always confirm in mock check? Or maybe random?
        inserted: new Date().toISOString()
      };
    }

    const auth = Buffer.from(`${this.config.apiUser}:${this.config.apiSecret}`).toString('base64');

    const response = await fetch(`${this.config.apiUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
        throw new Error(`ForumPay API Error: ${response.status}`);
    }

    return await response.json();
  }

  private mockStartPayment(req: PaymentRequest): PaymentResponse {
    console.log("[ForumPay] Mocking startPayment:", req);
    return {
      payment_id: `fp_${uuidv4().slice(0, 8)}`,
      address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', // Consistent demo address
      amount: req.amount,
      currency: req.currency,
      reference_no: req.orderId,
      status: 'waiting',
      inserted: new Date().toISOString()
    };
  }
}

export const forumPayClient = new ForumPayClient();
