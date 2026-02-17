import { z } from 'zod';

const envSchema = z.object({
    // DynamoDB
    DYNAMODB_TABLE_NAME: z.string().default('ForumpayInvoices'),
    AWS_REGION: z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string().optional(), // Optional for local mock or IAM roles
    AWS_SECRET_ACCESS_KEY: z.string().optional(),

    // ForumPay
    FORUMPAY_API_USER: z.string().min(1),
    FORUMPAY_API_SECRET: z.string().min(1),
    FORUMPAY_API_URL: z.string().url().default('https://api.forumpay.com/pay/v2/'),

    // App
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Security
    WEBHOOK_SECRET: z.string().min(1),

    // RPC (Comma separated for now, or json)
    RPC_URLS_ETH: z.string().optional(),
    RPC_URLS_POLYGON: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const validateEnv = () => {
    try {
        envSchema.parse(process.env);
        console.log('Environment variables validated.');
    } catch (e) {
        console.error('Invalid environment variables:', e);
        process.exit(1);
    }
};
