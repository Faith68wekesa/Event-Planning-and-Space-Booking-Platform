"""
M-Pesa Daraja service — STK Push + Query.
All config comes from settings.py (loaded from .env).
"""
import base64
from datetime import datetime

import requests
from django.conf import settings


SANDBOX_BASE = 'https://sandbox.safaricom.co.ke'
PRODUCTION_BASE = 'https://api.safaricom.co.ke'


def _base_url():
    return PRODUCTION_BASE if settings.MPESA_ENV == 'production' else SANDBOX_BASE


def get_timestamp():
    return datetime.now().strftime('%Y%m%d%H%M%S')


def get_password(timestamp):
    shortcode = settings.MPESA_SHORTCODE
    passkey = settings.MPESA_PASSKEY
    raw = f'{shortcode}{passkey}{timestamp}'
    return base64.b64encode(raw.encode()).decode()


def normalize_phone(phone: str) -> str:
    """Accept 07XX, +2547XX, 2547XX → returns 2547XXXXXXXX."""
    p = str(phone).replace(' ', '').replace('+', '').strip()
    if p.startswith('0'):
        p = '254' + p[1:]
    elif p.startswith('7') or p.startswith('1'):
        p = '254' + p
    if len(p) != 12 or not p.startswith('254'):
        raise ValueError(f'Invalid Kenyan phone number: {phone}')
    return p


def get_access_token() -> str:
    key = settings.MPESA_CONSUMER_KEY
    secret = settings.MPESA_CONSUMER_SECRET
    if not key or not secret:
        raise RuntimeError('MPESA_CONSUMER_KEY / SECRET not configured')

    auth = base64.b64encode(f'{key}:{secret}'.encode()).decode()
    url = f'{_base_url()}/oauth/v1/generate?grant_type=client_credentials'
    res = requests.get(url, headers={'Authorization': f'Basic {auth}'}, timeout=30)
    res.raise_for_status()
    return res.json()['access_token']


def initiate_stk_push(phone: str, amount: int, account_reference: str, description: str = 'Booking'):
    """
    Sends an STK prompt to the customer's phone.
    Returns the raw Safaricom JSON (contains CheckoutRequestID on success).
    """
    token = get_access_token()
    timestamp = get_timestamp()
    password = get_password(timestamp)
    phone = normalize_phone(phone)

    if amount < 1:
        raise ValueError('Amount must be at least 1 KES')
    if amount > 250000:
        raise ValueError('Amount exceeds M-Pesa limit of KES 250,000')

    payload = {
        'BusinessShortCode': settings.MPESA_SHORTCODE,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': 'CustomerPayBillOnline',
        'Amount': int(amount),
        'PartyA': phone,
        'PartyB': settings.MPESA_SHORTCODE,
        'PhoneNumber': phone,
        'CallBackURL': settings.MPESA_CALLBACK_URL,
        'AccountReference': str(account_reference)[:12],
        'TransactionDesc': str(description)[:13],
    }

    url = f'{_base_url()}/mpesa/stkpush/v1/processrequest'
    res = requests.post(
        url,
        json=payload,
        headers={'Authorization': f'Bearer {token}'},
        timeout=30,
    )
    return res.json()


def query_stk_status(checkout_request_id: str):
    """Manual fallback query — useful if callback is delayed."""
    token = get_access_token()
    timestamp = get_timestamp()
    password = get_password(timestamp)

    payload = {
        'BusinessShortCode': settings.MPESA_SHORTCODE,
        'Password': password,
        'Timestamp': timestamp,
        'CheckoutRequestID': checkout_request_id,
    }

    url = f'{_base_url()}/mpesa/stkpushquery/v1/query'
    res = requests.post(
        url,
        json=payload,
        headers={'Authorization': f'Bearer {token}'},
        timeout=30,
    )
    return res.json()