
import fs from 'fs';
import path from 'path';

import { InvoiceStatus, InvoiceStateMachine } from './invoice-state';

// Types based on the User Request
export interface Invoice {
  invoiceId: string;
  orderId: string;
  userId: string;
  walletAddress: string;
  amount: string;
  currency: string;
  network: string;
  status: InvoiceStatus;
  createdAt: string;
  expiresAt: string;
  txHash: string | null;
  paymentAddress: string; // From ForumPay
  lastIngestedEventId?: string;
}

const DB_PATH = path.join(process.cwd(), 'invoices_db.json');

// Helper to read DB
const readDb = (): Invoice[] => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return [];
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading DB:", error);
    return [];
  }
};

// Helper to write DB
const writeDb = (invoices: Invoice[]) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(invoices, null, 2));
  } catch (error) {
    console.error("Error writing DB:", error);
  }
};

export const InvoiceRepository = {
  save: async (invoice: Invoice): Promise<void> => {
    const invoices = readDb();
    // Rule: No invoice reuse (check ID)
    if (invoices.find(i => i.invoiceId === invoice.invoiceId)) {
      throw new Error(`Invoice ${invoice.invoiceId} already exists`);
    }
    invoices.push(invoice);
    writeDb(invoices);
  },

  updateStatus: async (invoiceId: string, status: InvoiceStatus, txHash?: string, eventId?: string): Promise<void> => {
    const invoices = readDb();
    const index = invoices.findIndex(i => i.invoiceId === invoiceId);
    if (index === -1) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const current = invoices[index];
    
    // Idempotency Check
    if (eventId && current.lastIngestedEventId === eventId) {
        console.log(`Event ${eventId} already processed for invoice ${invoiceId}`);
        return;
    }

    // Validate transition using State Machine
    try {
        InvoiceStateMachine.validateTransition(current.status, status);
    } catch (e: any) {
        console.error(`State transition error for invoice ${invoiceId}: ${e.message}`);
        throw e;
    }

    invoices[index] = {
      ...current,
      status,
      txHash: txHash || current.txHash,
      lastIngestedEventId: eventId || current.lastIngestedEventId
    };
    writeDb(invoices);
  },

  findById: async (invoiceId: string): Promise<Invoice | null> => {
    const invoices = readDb();
    return invoices.find(i => i.invoiceId === invoiceId) || null;
  },
  
  // For frontend polling
  findByOrderId: async (orderId: string): Promise<Invoice | null> => {
      const invoices = readDb();
      return invoices.find(i => i.orderId === orderId) || null;
  },

  findPending: async (): Promise<Invoice[]> => {
      const invoices = readDb();
      return invoices.filter(i => i.status === InvoiceStatus.PENDING || i.status === InvoiceStatus.DETECTED);
  }
};
