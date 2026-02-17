import { v4 as uuidv4 } from 'uuid';

export interface LogContext {
    invoiceId?: string;
    userId?: string;
    chain?: string;
    txHash?: string;
    correlationId?: string;
    [key: string]: any;
}

class Logger {
    private static instance: Logger;

    private constructor() { }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private formatMessage(level: string, message: string, context: LogContext = {}) {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            correlationId: context.correlationId || uuidv4(),
            ...context,
        });
    }

    public info(message: string, context?: LogContext) {
        console.log(this.formatMessage('INFO', message, context));
    }

    public warn(message: string, context?: LogContext) {
        console.warn(this.formatMessage('WARN', message, context));
    }

    public error(message: string, context?: LogContext) {
        console.error(this.formatMessage('ERROR', message, context));
    }

    public debug(message: string, context?: LogContext) {
        if (process.env.LOG_LEVEL === 'debug') {
            console.debug(this.formatMessage('DEBUG', message, context));
        }
    }
}

export const logger = Logger.getInstance();
