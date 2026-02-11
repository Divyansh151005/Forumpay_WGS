
import { InvoiceStatus, InvoiceStateMachine } from '@/lib/invoice-state';
import { Security } from '@/lib/security';
import { forumPayClient } from '@/lib/forumpay/client';
import crypto from 'crypto';

async function runTests() {
    console.log("Starting Core Verification...\n");
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, msg: string) {
        if (condition) {
            console.log(`✅ ${msg}`);
            passed++;
        } else {
            console.error(`❌ ${msg}`);
            failed++;
        }
    }

    // 1. Test State Machine
    console.log("[Test] InvoiceStateMachine");
    try {
        InvoiceStateMachine.validateTransition(InvoiceStatus.PENDING, InvoiceStatus.DETECTED);
        assert(true, "PENDING -> DETECTED allowed");
        
        try {
            InvoiceStateMachine.validateTransition(InvoiceStatus.PAID, InvoiceStatus.PENDING);
            assert(false, "PAID -> PENDING should fail");
        } catch(e) {
            assert(true, "PAID -> PENDING correctly rejected");
        }
    } catch(e) {
        console.error(e);
        failed++;
    }

    // 2. Test Security HMAC
    console.log("\n[Test] Security HMAC");
    const secret = "test_secret";
    const body = JSON.stringify({ foo: "bar" });
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
    
    assert(Security.verifyWebhookSignature(hmac, body, secret), "Valid signature accepted");
    assert(!Security.verifyWebhookSignature("wrong", body, secret), "Invalid signature rejected");

    // 3. Test Timestamp
    console.log("\n[Test] Security Timestamp");
    const now = Math.floor(Date.now() / 1000).toString();
    const old = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 mins ago

    assert(Security.validateTimestamp(now), "Current timestamp accepted");
    assert(!Security.validateTimestamp(old), "Old timestamp rejected");


    // 4. Test ForumPay Client Mock
    console.log("\n[Test] ForumPay Client Mock");
    try {
        const payment = await forumPayClient.startPayment({
            amount: "100",
            currency: "ETH",
            orderId: "test_order"
        });
        assert(payment.payment_id.startsWith("fp_"), "Mock payment ID generated");
        assert(payment.status === "waiting", "Mock payment status is waiting");
    } catch(e) {
        console.error(e);
        failed++;
    }

    console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
    if (failed > 0) process.exit(1);
}

runTests();
