/**
 * M-Pesa API Client for Django Backend
 */
import { API_BASE_URL } from './apiBase';

export type MpesaStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface PaymentRecord {
    checkoutRequestId: string;
    merchantRequestId: string;
    bookingId: number | string;
    customerPhone: string;
    amount: number;
    accountReference: string;
    status: MpesaStatus;
    resultCode: number | null;
    resultDesc: string | null;
    mpesaReceiptNumber: string | null;
    transactionDate: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface StkPushResponse {
    success: boolean;
    message: string;
    checkoutRequestId?: string;
    merchantRequestId?: string;
    customerMessage?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    const data = await res.json();
    return data as T;
}

export const initiateStkPush = (params: {
    bookingId: number | string;
    phone: string;
    amount: number;
    accountReference?: string;
}): Promise<StkPushResponse> =>
    request<StkPushResponse>('/api/mpesa/stkpush/', {
        method: 'POST',
        body: JSON.stringify(params),
    });

export const getPaymentStatus = (
    checkoutRequestId: string
): Promise<{ success: boolean; payment: PaymentRecord }> =>
    request(`/api/mpesa/status/${checkoutRequestId}/`);

export const getPaymentByBooking = async (
    bookingId: number | string
): Promise<PaymentRecord | null> => {
    try {
        const res = await request<{ success: boolean; payment: PaymentRecord }>(
            `/api/mpesa/status-by-booking/${bookingId}/`
        );
        return res.payment || null;
    } catch {
        return null;
    }
};

/** 
 * Polls the backend every 3 seconds until the payment succeeds, fails, or times out (90 seconds).
 */
export const pollPaymentStatus = async (
    checkoutRequestId: string,
    onUpdate?: (p: PaymentRecord) => void,
    { intervalMs = 3000, timeoutMs = 90000 } = {}
): Promise<PaymentRecord | null> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const { payment } = await getPaymentStatus(checkoutRequestId);
            if (payment) {
                onUpdate?.(payment);
                if (payment.status !== 'PENDING') return payment;
            }
        } catch {
            // Ignore transient network errors and keep polling
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null; // Timed out
};