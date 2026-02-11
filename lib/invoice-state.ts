
export enum InvoiceStatus {
  PENDING = 'PENDING',
  DETECTED = 'DETECTED',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

export class InvoiceStateMachine {
  private static transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.PENDING]: [InvoiceStatus.DETECTED, InvoiceStatus.EXPIRED, InvoiceStatus.FAILED],
    [InvoiceStatus.DETECTED]: [InvoiceStatus.CONFIRMED, InvoiceStatus.FAILED, InvoiceStatus.EXPIRED],
    [InvoiceStatus.CONFIRMED]: [InvoiceStatus.PAID, InvoiceStatus.FAILED],
    [InvoiceStatus.PAID]: [], // Final state
    [InvoiceStatus.FAILED]: [], // Final state
    [InvoiceStatus.EXPIRED]: [] // Final state
  };

  static validateTransition(current: InvoiceStatus, next: InvoiceStatus): void {
    const allowed = this.transitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new Error(`Invalid state transition: ${current} -> ${next}`);
    }
  }

  static canTransition(current: InvoiceStatus, next: InvoiceStatus): boolean {
    const allowed = this.transitions[current];
    return allowed ? allowed.includes(next) : false;
  }
}
