
export enum WGSInvoiceStatus {
    CREATED = 'CREATED',
    PROCESSOR_PENDING = 'PROCESSOR_PENDING',
    PAID = 'PAID',
    EXPIRED = 'EXPIRED',
    FAILED = 'FAILED'
}

export interface InvoiceProps {
    invoiceId: string;
    forumInvoiceId?: string;
    merchantId: string;
    payerUserId: string;
    walletAddress: string;
    amount: string;
    currency: string;
    network: string;
    status: WGSInvoiceStatus;
    processor: string;
    createdAt: Date;
    expiresAt: Date;
    txHash?: string;
}

export class InvoiceAggregate {
    private props: InvoiceProps;

    constructor(props: InvoiceProps) {
        this.props = props;
    }

    public static create(data: Omit<InvoiceProps, 'status' | 'createdAt' | 'processor'> & { processor?: string }): InvoiceAggregate {
        return new InvoiceAggregate({
            ...data,
            status: WGSInvoiceStatus.CREATED,
            createdAt: new Date(),
            processor: data.processor || 'FORUMPAY'
        });
    }

    public get id(): string { return this.props.invoiceId; }
    public get forumInvoiceId(): string | undefined { return this.props.forumInvoiceId; }
    public get status(): WGSInvoiceStatus { return this.props.status; }
    public get props_copy(): InvoiceProps { return { ...this.props }; }

    public setForumInvoiceId(id: string): void {
        if (this.props.status !== WGSInvoiceStatus.CREATED) {
            throw new Error(`Cannot set forumInvoiceId in ${this.props.status} state`);
        }
        this.props.forumInvoiceId = id;
        this.props.status = WGSInvoiceStatus.PROCESSOR_PENDING;
    }

    public markAsPaid(txHash?: string): void {
        this.validateTransition(WGSInvoiceStatus.PAID);
        this.props.status = WGSInvoiceStatus.PAID;
        if (txHash) this.props.txHash = txHash;
    }

    public markAsExpired(): void {
        this.validateTransition(WGSInvoiceStatus.EXPIRED);
        this.props.status = WGSInvoiceStatus.EXPIRED;
    }

    public markAsFailed(): void {
        this.validateTransition(WGSInvoiceStatus.FAILED);
        this.props.status = WGSInvoiceStatus.FAILED;
    }

    private validateTransition(nextStatus: WGSInvoiceStatus): void {
        const allowed: Record<WGSInvoiceStatus, WGSInvoiceStatus[]> = {
            [WGSInvoiceStatus.CREATED]: [WGSInvoiceStatus.PROCESSOR_PENDING, WGSInvoiceStatus.FAILED],
            [WGSInvoiceStatus.PROCESSOR_PENDING]: [WGSInvoiceStatus.PAID, WGSInvoiceStatus.EXPIRED, WGSInvoiceStatus.FAILED],
            [WGSInvoiceStatus.PAID]: [],
            [WGSInvoiceStatus.EXPIRED]: [],
            [WGSInvoiceStatus.FAILED]: []
        };

        if (!allowed[this.props.status].includes(nextStatus)) {
            throw new Error(`Invalid state transition: ${this.props.status} -> ${nextStatus}`);
        }
    }

    public toJSON() {
        return {
            ...this.props,
            createdAt: this.props.createdAt.toISOString(),
            expiresAt: this.props.expiresAt.toISOString()
        };
    }

    public static fromJSON(data: any): InvoiceAggregate {
        return new InvoiceAggregate({
            ...data,
            createdAt: new Date(data.createdAt),
            expiresAt: new Date(data.expiresAt)
        });
    }
}
