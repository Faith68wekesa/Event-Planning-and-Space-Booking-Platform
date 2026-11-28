"""M-Pesa Daraja collection and payout requests."""
import base64
from datetime import datetime

import requests
from django.conf import settings


SANDBOX_BASE = 'https://sandbox.safaricom.co.ke'
PRODUCTION_BASE = 'https://api.safaricom.co.ke'


class PayoutNotSubmittedError(Exception):
    """The B2C request could not be sent, so a safe retry is possible."""


class PayoutOutcomeUnknownError(Exception):
    """The B2C request may have been accepted; retrying could pay twice."""


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


def initiate_b2c_payout(phone: str, amount: int, account_reference: str):
    """Submit one provider payout through Daraja B2C."""
    required_settings = {
        'MPESA_B2C_INITIATOR_NAME': settings.MPESA_B2C_INITIATOR_NAME,
        'MPESA_B2C_SECURITY_CREDENTIAL': settings.MPESA_B2C_SECURITY_CREDENTIAL,
        'MPESA_B2C_SHORTCODE': settings.MPESA_B2C_SHORTCODE,
        'MPESA_B2C_RESULT_URL': settings.MPESA_B2C_RESULT_URL,
        'MPESA_B2C_TIMEOUT_URL': settings.MPESA_B2C_TIMEOUT_URL,
    }
    missing = [name for name, value in required_settings.items() if not value]
    if missing:
        raise PayoutNotSubmittedError(
            'B2C payout configuration is incomplete: ' + ', '.join(missing)
        )

    phone = normalize_phone(phone)
    if amount < 1:
        raise PayoutNotSubmittedError('B2C payout amount must be at least KES 1.')

    try:
        token = get_access_token()
    except Exception as exc:
        raise PayoutNotSubmittedError('Could not authenticate with Daraja for B2C.') from exc

    payload = {
        'InitiatorName': settings.MPESA_B2C_INITIATOR_NAME,
        'SecurityCredential': settings.MPESA_B2C_SECURITY_CREDENTIAL,
        'CommandID': settings.MPESA_B2C_COMMAND_ID,
        'Amount': int(amount),
        'PartyA': settings.MPESA_B2C_SHORTCODE,
        'PartyB': phone,
        'Remarks': settings.MPESA_B2C_REMARKS,
        'QueueTimeOutURL': settings.MPESA_B2C_TIMEOUT_URL,
        'ResultURL': settings.MPESA_B2C_RESULT_URL,
        'Occasion': str(account_reference)[:100],
    }

    try:
        response = requests.post(
            f'{_base_url()}/mpesa/b2c/v1/paymentrequest',
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise PayoutOutcomeUnknownError(
            'Daraja did not return a definitive B2C submission response.'
        ) from exc