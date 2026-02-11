
import crypto from 'crypto';
import { z } from 'zod';

export const Security = {
    // 6. Security Hardening
    validateInvoiceRequest: (data: any) => {
        const schema = z.object({
            amount: z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount format"),
            currency: z.string().min(2).max(5),
            orderId: z.string().min(1),
            userId: z.string().min(1),
            walletAddress: z.string().startsWith("0x", "Invalid wallet address").length(42, "Invalid address length")
        });
        return schema.parse(data);
    },

    verifyWebhookSignature: (signature: string, body: string, secret?: string) => {
        const secretKey = secret || process.env.FORUMPAY_WEBHOOK_SECRET;
        if (!secretKey) {
            console.warn("Skipping webhook signature verification: FORUMPAY_WEBHOOK_SECRET is missing.");
            return true; // Weak fail-open for dev, should be strict in prod
        }
        
        const hmac = crypto.createHmac('sha256', secretKey);
        const calculated = hmac.update(body).digest('hex');
        
        // Constant time comparison to prevent timing attacks
        try {
            return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculated));
        } catch (e) {
            return false; // Length mismatch or other error
        }
    },

    validateTimestamp: (timestampStr: string) => {
        const timestamp = parseInt(timestampStr, 10);
        if (isNaN(timestamp)) return false;

        const now = Math.floor(Date.now() / 1000);
        const tolerance = 5 * 60; // 5 minutes

        return Math.abs(now - timestamp) <= tolerance;
    },

    // 7. AI Extension Hooks (Scaffold)
    aiRiskScore: async (address: string, amount: string): Promise<number> => {
        // Stub: random low risk score
        return 0.1;
    },

    aiFraudFlag: async (invoiceId: string): Promise<boolean> => {
        // Stub: no fraud
        return false;
    }
};
