<?php
declare(strict_types=1);

final class PaymentService
{
    /** User submits manual payment details. Creates a PENDING request only - never activates anything. */
    public static function submit(array $user, array $in, ?array $file): int
    {
        $uid = (int)$user['id'];
        $v = new V($in);
        $planId = $v->id('plan_id', 'Plan');
        $methodId = $v->id('method_id', 'Payment method');
        $amount = $v->amount('amount', 'Amount paid');
        $ref = $v->str('reference', 'Transaction reference', true, 80, 3);
        $date = $v->date('pay_date', 'Payment date');
        $notes = $v->str('notes', 'Notes', false, 500);
        $v->done();
        if ($date > today()) throw new ApiException('Payment date cannot be in the future.', 422, ['pay_date' => 'Payment date cannot be in the future.']);
        if (!q_one('SELECT id FROM subscription_plans WHERE id = ? AND is_active = 1', [$planId])) throw new ApiException('Please choose a valid plan.', 422, ['plan_id' => 'Please choose a valid plan.']);
        if (!q_one('SELECT id FROM payment_methods WHERE id = ? AND is_active = 1', [$methodId])) throw new ApiException('Please choose a valid payment method.', 422, ['method_id' => 'Please choose a valid payment method.']);
        if ((int)q_val("SELECT COUNT(*) FROM subscription_payments WHERE user_id = ? AND status = 'pending'", [$uid]) >= 3) {
            throw new ApiException('You already have pending payment requests. Please wait for them to be reviewed.', 429);
        }
        if (q_val("SELECT id FROM subscription_payments WHERE method_id = ? AND LOWER(reference) = LOWER(?) AND status IN ('pending','approved')", [$methodId, $ref])) {
            throw new ApiException('This transaction reference has already been submitted.', 422, ['reference' => 'This transaction reference has already been submitted.']);
        }
        $stored = null;
        if ($file && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) $stored = store_private_file($file, 'receipts');

        $id = (int)in_tx(function () use ($uid, $planId, $methodId, $amount, $ref, $date, $notes, $stored) {
            q('INSERT INTO subscription_payments (user_id, plan_id, method_id, amount, reference, pay_date, notes, receipt_file) VALUES (?,?,?,?,?,?,?,?)',
                [$uid, $planId, $methodId, $amount, $ref, $date, $notes, $stored]);
            return (int)db()->lastInsertId();
        });
        SubscriptionService::flush();
        audit($uid, 'payment_submitted', 'subscription_payment', $id, 'success', ['amount' => $amount]);
        NotificationService::send($uid, 'payment_submitted', 'Payment received for review', 'We received your payment details (ref ' . $ref . '). You will be notified once it has been reviewed.', 'subscription.html', "pay-sub:$id");
        NotificationService::toAdmins('payment_pending', 'New payment awaiting review', "{$user['full_name']} submitted " . money_fmt($amount) . " (ref $ref).", 'admin-payments.html', "pay-admin:$id");
        return $id;
    }

    /** Authorised approval: transactionally activates/extends the subscription. Idempotent per payment and per reference. */
    public static function approve(int $adminId, int $paymentId, ?int $periods = null): array
    {
        $result = in_tx(function () use ($adminId, $paymentId, $periods) {
            $p = q_one('SELECT * FROM subscription_payments WHERE id = ? FOR UPDATE', [$paymentId]);
            if (!$p) throw new ApiException('Payment not found.', 404);
            if ($p['status'] !== 'pending') throw new ApiException('This payment has already been ' . $p['status'] . '.', 409);
            $refKey = substr($p['method_id'] . ':' . strtolower($p['reference']), 0, 160);
            if (q_val('SELECT id FROM subscription_payments WHERE approved_ref_key = ?', [$refKey])) {
                throw new ApiException('A payment with this reference was already approved.', 409);
            }
            $plan = q_one('SELECT * FROM subscription_plans WHERE id = ?', [$p['plan_id']]);
            $price = to_cents($plan['price']);
            $n = $periods ?? ($price > 0 ? max(1, intdiv(to_cents($p['amount']), $price)) : 1);
            $n = max(1, min(36, $n));
            $sub = SubscriptionService::grant((int)$p['user_id'], (int)$plan['id'], (int)$plan['period_months'] * $n, 'payment', $adminId, 'Payment #' . $paymentId);
            q("UPDATE subscription_payments SET status='approved', reviewed_by=?, reviewed_at=?, subscription_id=?, approved_ref_key=? WHERE id=? AND status='pending'",
                [$adminId, now_utc(), $sub['id'], $refKey, $paymentId]);
            return [$p, $sub];
        });
        [$p, $sub] = $result;
        audit($adminId, 'payment_approved', 'subscription_payment', $paymentId, 'success', ['user_id' => (int)$p['user_id'], 'ends_at' => $sub['ends_at']]);
        $msg = str_replace('{date}', substr($sub['ends_at'], 0, 10), (string)setting('msg_approved'));
        NotificationService::send((int)$p['user_id'], 'payment_approved', 'Payment approved', $msg, 'subscription.html', "pay-approved:$paymentId");
        return ['subscription' => $sub];
    }

    public static function reject(int $adminId, int $paymentId, ?string $reason): void
    {
        $p = in_tx(function () use ($adminId, $paymentId, $reason) {
            $p = q_one('SELECT * FROM subscription_payments WHERE id = ? FOR UPDATE', [$paymentId]);
            if (!$p) throw new ApiException('Payment not found.', 404);
            if ($p['status'] !== 'pending') throw new ApiException('This payment has already been ' . $p['status'] . '.', 409);
            q("UPDATE subscription_payments SET status='rejected', reviewed_by=?, reviewed_at=?, reject_reason=? WHERE id=?", [$adminId, now_utc(), $reason, $paymentId]);
            return $p;
        });
        SubscriptionService::flush();
        audit($adminId, 'payment_rejected', 'subscription_payment', $paymentId, 'success', ['user_id' => (int)$p['user_id']]);
        $msg = str_replace('{reason}', $reason ? 'Reason: ' . $reason : 'You can correct the details and submit again.', (string)setting('msg_rejected'));
        NotificationService::send((int)$p['user_id'], 'payment_rejected', 'Payment not approved', $msg, 'subscription.html', "pay-rejected:$paymentId");
    }
}
