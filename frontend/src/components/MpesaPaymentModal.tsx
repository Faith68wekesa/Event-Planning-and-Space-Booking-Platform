import React, { useState, useEffect, useRef } from 'react';
import {
    X, Smartphone, Loader2, CheckCircle2, XCircle,
    ShieldCheck, AlertCircle, RefreshCw,
} from 'lucide-react';
import type { Booking } from '../types';
import {
    initiateStkPush,
    pollPaymentStatus,
    type PaymentRecord,
} from '../services/mpesa';

interface MpesaPaymentModalProps {
    booking: Booking;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (payment: PaymentRecord) => void;
    defaultPhone?: string;
}

type Stage = 'INPUT' | 'WAITING' | 'SUCCESS' | 'FAILED';

export const MpesaPaymentModal: React.FC<MpesaPaymentModalProps> = ({
    booking,
    isOpen,
    onClose,
    onSuccess,
    defaultPhone = '',
}) => {
    const [phone, setPhone] = useState(defaultPhone);
    const [stage, setStage] = useState<Stage>('INPUT');
    const [payment, setPayment] = useState<PaymentRecord | null>(null);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Use a ref to prevent state updates if the user closes the modal
    const isCancelled = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            setStage('INPUT');
            setPayment(null);
            setError('');
            setSubmitting(false);
            isCancelled.current = false;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const amount = Number(booking.total_price);
    const accountRef = `EVT-${booking.id}`;

    const handleSendStk = async () => {
        setError('');
        setSubmitting(true);
        isCancelled.current = false;

        try {
            const res = await initiateStkPush({
                bookingId: booking.id,
                phone,
                amount,
                accountReference: accountRef,
            });

            if (!res.success || !res.checkoutRequestId) {
                setError(res.message || 'Failed to send STK push');
                setSubmitting(false);
                return;
            }

            setStage('WAITING');

            // Start polling the Django backend
            const finalRecord = await pollPaymentStatus(res.checkoutRequestId, (p) => {
                if (!isCancelled.current) setPayment(p);
            });

            if (isCancelled.current) return;

            if (finalRecord?.status === 'SUCCESS') {
                setPayment(finalRecord);
                setStage('SUCCESS');
                onSuccess(finalRecord);
            } else {
                setPayment(finalRecord);
                setStage('FAILED');
                setError(
                    finalRecord?.resultDesc ||
                    (finalRecord?.status === 'CANCELLED'
                        ? 'You cancelled the request on your phone.'
                        : 'Payment was not completed. Please try again.')
                );
            }
        } catch (err: any) {
            setError(err?.message || 'Network error. Please try again.');
            setStage('FAILED');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetry = () => {
        setStage('INPUT');
        setPayment(null);
        setError('');
    };

    const handleClose = () => {
        isCancelled.current = true;
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '480px' }}
            >
                <button
                    onClick={handleClose}
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: '#222222', border: '1px solid #DFE3E8', color: '#FFFFFF',
                        borderRadius: '999px', width: '32px', height: '32px',
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <X size={18} />
                </button>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(0, 122, 101, 0.12)', color: '#007A65',
                        padding: '4px 14px', borderRadius: '999px', fontSize: '0.78rem',
                        fontWeight: 800, marginBottom: '8px',
                    }}>
                        <Smartphone size={13} color="#007A65" /> M-PESA PAYMENT
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#222222', margin: 0 }}>
                        Pay for Booking
                    </h2>
                    <p style={{ color: '#637381', fontSize: '0.86rem', marginTop: '4px' }}>
                        {booking.event_title} • Ref #{accountRef}
                    </p>
                </div>

                {/* Amount */}
                <div style={{
                    background: '#F9FAFB', border: '1px solid #DFE3E8',
                    borderRadius: '12px', padding: '16px',
                    marginBottom: '20px', textAlign: 'center',
                }}>
                    <span style={{ fontSize: '0.78rem', color: '#637381', fontWeight: 600 }}>
                        Amount to Pay
                    </span>
                    <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#007A65' }}>
                        KES {amount.toLocaleString()}
                    </div>
                </div>

                {stage === 'INPUT' && (
                    <>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{
                                display: 'block', fontSize: '0.85rem', fontWeight: 700,
                                color: '#222222', marginBottom: '6px',
                            }}>
                                M-Pesa Phone Number
                            </label>
                            <input
                                type="tel"
                                placeholder="e.g. 0712345678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                disabled={submitting}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                                    border: '1px solid #DFE3E8', fontSize: '1rem', outline: 'none'
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '6px' }}>
                                You'll receive an M-Pesa prompt. Enter your PIN to confirm.
                            </p>
                        </div>

                        {error && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#dc2626', padding: '10px',
                                borderRadius: '10px', fontSize: '0.82rem',
                                marginBottom: '14px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}

                        <button
                            className="btn-primary"
                            onClick={handleSendStk}
                            disabled={submitting || !phone}
                            style={{ width: '100%', padding: '12px', fontSize: '0.98rem', justifyContent: 'center' }}
                        >
                            {submitting ? (
                                <><Loader2 size={18} className="spin" /> Sending Prompt...</>
                            ) : (
                                <>Send STK Push</>
                            )}
                        </button>

                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '4px', fontSize: '0.72rem', color: '#6B7280', marginTop: '14px',
                        }}>
                            <ShieldCheck size={12} color="#007A65" /> Secured by Safaricom Daraja
                        </div>
                    </>
                )}

                {stage === 'WAITING' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <Loader2 size={48} color="#007A65" className="spin"
                            style={{ marginBottom: '16px', margin: '0 auto' }} />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#222222', marginBottom: '6px' }}>
                            Waiting for PIN...
                        </h3>
                        <p style={{
                            fontSize: '0.85rem', color: '#637381',
                            maxWidth: '320px', margin: '0 auto',
                        }}>
                            Please check your phone and enter your M-Pesa PIN to complete the payment.
                        </p>
                    </div>
                )}

                {stage === 'SUCCESS' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <CheckCircle2 size={56} color="#007A65" style={{ marginBottom: '16px', margin: '0 auto' }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#222222', marginBottom: '6px' }}>
                            Payment Successful!
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#637381', marginBottom: '16px' }}>
                            Your booking is confirmed.
                        </p>

                        <div style={{
                            background: '#E6F5F2', border: '1px solid rgba(0, 122, 101, 0.25)',
                            borderRadius: '10px', padding: '12px',
                            textAlign: 'left', fontSize: '0.82rem',
                            color: '#006050', marginBottom: '16px',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span>M-Pesa Receipt:</span>
                                <strong>{payment?.mpesaReceiptNumber || '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Amount Paid:</span>
                                <strong>KES {amount.toLocaleString()}</strong>
                            </div>
                        </div>

                        <button className="btn-primary" onClick={handleClose} style={{ width: '100%', justifyContent: 'center' }}>
                            Done
                        </button>
                    </div>
                )}

                {stage === 'FAILED' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <XCircle size={56} color="#dc2626" style={{ marginBottom: '16px', margin: '0 auto' }} />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#222222', marginBottom: '6px' }}>
                            Payment Failed
                        </h3>
                        <p style={{
                            fontSize: '0.85rem', color: '#637381',
                            maxWidth: '320px', margin: '0 auto 20px auto',
                        }}>
                            {error || 'The payment request was not completed.'}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn-secondary" onClick={handleClose} style={{ flex: 1 }}>
                                Cancel
                            </button>
                            <button className="btn-primary" onClick={handleRetry} style={{ flex: 1, justifyContent: 'center' }}>
                                <RefreshCw size={14} /> Try Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MpesaPaymentModal;