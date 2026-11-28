import logging
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from core.models import Booking, Payment, PayoutAttempt
from core.services import mpesa


logger = logging.getLogger(__name__)
KES_UNIT = Decimal('1')


class PayoutRetryNotAllowed(Exception):
    pass


def calculate_payment_split(amount):
    amount = Decimal(str(amount)).quantize(KES_UNIT, rounding=ROUND_HALF_UP)
    rate = Decimal(str(settings.PLATFORM_COMMISSION_RATE))
    if amount <= 0 or rate < 0 or rate >= 1:
        raise ValueError('Payment amount and commission rate must be valid.')

    commission = (amount * rate).quantize(KES_UNIT, rounding=ROUND_HALF_UP)
    return commission, amount - commission


def resolve_provider_phone(booking):
    profiles = []
    if booking.venue:
        if booking.venue.listing_type == 'SERVICE':
            profiles.extend([booking.venue.vendor, booking.venue.owner])
        else:
            profiles.extend([booking.venue.owner, booking.venue.vendor])
    elif booking.vendor:
        profiles.append(booking.vendor)

    for profile in profiles:
        if not profile:
            continue
        candidates = [profile.contact_phone]
        if profile.user:
            candidates.append(profile.user.phone_number)
        for candidate in candidates:
            if not candidate:
                continue
            try:
                return mpesa.normalize_phone(candidate)
            except ValueError:
                continue

    raise ValueError('The provider has no valid M-Pesa payout phone number.')


def _lock_payment_and_booking(payment_id):
    booking_id = Payment.objects.only('booking_id').get(pk=payment_id).booking_id
    Booking.objects.select_for_update().only('id').get(pk=booking_id)
    booking = Booking.objects.select_related(
        'venue__owner__user',
        'venue__vendor__user',
        'vendor__user',
    ).get(pk=booking_id)
    payment = Payment.objects.select_for_update().get(pk=payment_id)
    return booking, payment


def _record_submission_failure(payment_id, attempt_id, message):
    with transaction.atomic():
        booking, payment = _lock_payment_and_booking(payment_id)
        attempt = PayoutAttempt.objects.select_for_update().get(pk=attempt_id)
        if attempt.status != 'PENDING':
            return payment

        attempt.status = 'FAILED'
        attempt.result_desc = message
        attempt.completed_at = timezone.now()
        attempt.save(update_fields=['status', 'result_desc', 'completed_at'])

        payment.payout_status = 'FAILED'
        payment.payout_error = message
        payment.payout_retryable = booking.status != 'CANCELLED'
        payment.manual_reconciliation_required = booking.status == 'CANCELLED'
        payment.save(update_fields=[
            'payout_status',
            'payout_error',
            'payout_retryable',
            'manual_reconciliation_required',
            'updated_at',
        ])
        return payment


def _record_unknown_submission(
    payment_id,
    attempt_id,
    message,
    conversation_id='',
    originator_id='',
):
    with transaction.atomic():
        booking, payment = _lock_payment_and_booking(payment_id)
        attempt = PayoutAttempt.objects.select_for_update().get(pk=attempt_id)
        if attempt.status != 'PENDING':
            return payment
        attempt_fields = ['result_desc']
        payment_fields = ['payout_error', 'manual_reconciliation_required', 'updated_at']
        if conversation_id:
            attempt.conversation_id = conversation_id
            payment.payout_conversation_id = conversation_id
            attempt_fields.append('conversation_id')
            payment_fields.append('payout_conversation_id')
        if originator_id:
            attempt.originator_conversation_id = originator_id
            payment.payout_originator_conversation_id = originator_id
            attempt_fields.append('originator_conversation_id')
            payment_fields.append('payout_originator_conversation_id')
        attempt.result_desc = message
        attempt.save(update_fields=attempt_fields)

        payment.payout_error = message
        payment.manual_reconciliation_required = (
            booking.status == 'CANCELLED' or payment.manual_reconciliation_required
        )
        payment.save(update_fields=payment_fields)
        logger.error(
            'B2C payout outcome is unknown for payment ID %s; awaiting Daraja callback.',
            payment_id,
        )
        return payment


def initiate_provider_payout(payment_id, retry=False):
    with transaction.atomic():
        booking, payment = _lock_payment_and_booking(payment_id)
        if payment.status != 'SUCCESS' or payment.is_simulated:
            raise PayoutRetryNotAllowed('Only real, successful collections can be paid out.')
        if payment.payout_status == 'PAID':
            raise PayoutRetryNotAllowed('This provider payout has already been paid.')

        if retry:
            if payment.payout_status != 'FAILED' or not payment.payout_retryable:
                raise PayoutRetryNotAllowed(
                    'Only confirmed payout failures can be retried.'
                )
        elif payment.payout_status != 'PENDING' or payment.payout_attempted_at:
            return payment

        if booking.status == 'CANCELLED' or payment.manual_reconciliation_required:
            payment.payout_status = 'FAILED' if not payment.payout_attempted_at else 'PENDING'
            payment.payout_retryable = False
            payment.manual_reconciliation_required = True
            if payment.payout_attempted_at:
                payment.payout_error = (
                    'A payout request may already be in progress; manual reconciliation is required. '
                    'No automatic reversal or refund was issued.'
                )
            else:
                payment.payout_error = (
                    'Booking cancellation requires manual payment reconciliation; '
                    'no payout or refund was issued.'
                )
            payment.save(update_fields=[
                'payout_status',
                'payout_retryable',
                'manual_reconciliation_required',
                'payout_error',
                'updated_at',
            ])
            return payment

        try:
            phone = (
                resolve_provider_phone(booking)
                if retry
                else (payment.payout_phone or resolve_provider_phone(booking))
            )
            phone = mpesa.normalize_phone(phone)
            amount = int(payment.provider_payout_amount)
            if amount < 1:
                raise ValueError('Provider payout amount must be at least KES 1.')
        except (TypeError, ValueError) as exc:
            payment.payout_status = 'FAILED'
            payment.payout_retryable = True
            payment.payout_error = str(exc)
            payment.save(update_fields=[
                'payout_status',
                'payout_retryable',
                'payout_error',
                'updated_at',
            ])
            return payment

        attempt_number = payment.payout_attempts.count() + 1
        attempt = PayoutAttempt.objects.create(
            payment=payment,
            attempt_number=attempt_number,
            amount=payment.provider_payout_amount,
            phone=phone,
        )
        payment.payout_status = 'PENDING'
        payment.payout_phone = phone
        payment.payout_attempted_at = timezone.now()
        payment.payout_retryable = False
        payment.payout_error = ''
        payment.save(update_fields=[
            'payout_status',
            'payout_phone',
            'payout_attempted_at',
            'payout_retryable',
            'payout_error',
            'updated_at',
        ])

    try:
        response = mpesa.initiate_b2c_payout(
            phone=phone,
            amount=amount,
            account_reference=f'LOCYFY-{booking.id}-{payment.id}-{attempt_number}',
        )
    except mpesa.PayoutNotSubmittedError as exc:
        logger.warning('B2C payout was not submitted for payment ID %s: %s', payment_id, exc)
        return _record_submission_failure(payment_id, attempt.id, str(exc))
    except mpesa.PayoutOutcomeUnknownError as exc:
        logger.exception('B2C payout submission outcome is unknown for payment ID %s.', payment_id)
        return _record_unknown_submission(payment_id, attempt.id, str(exc))

    if not isinstance(response, dict):
        return _record_unknown_submission(
            payment_id,
            attempt.id,
            'Daraja returned an invalid B2C response; payout outcome is unknown.',
        )

    conversation_id = str(response.get('ConversationID') or '')
    originator_id = str(response.get('OriginatorConversationID') or '')
    response_code = str(response.get('ResponseCode', ''))
    if not response_code:
        return _record_unknown_submission(
            payment_id,
            attempt.id,
            'Daraja returned an incomplete B2C response; payout outcome is unknown.',
            conversation_id,
            originator_id,
        )
    if response_code == '0' and not conversation_id and not originator_id:
        return _record_unknown_submission(
            payment_id,
            attempt.id,
            'Daraja accepted the payout without transaction identifiers; manual reconciliation is required.',
        )
    response_desc = str(
        response.get('ResponseDescription')
        or response.get('errorMessage')
        or 'Daraja rejected the B2C payout request.'
    )

    with transaction.atomic():
        current_booking, current_payment = _lock_payment_and_booking(payment_id)
        current_attempt = PayoutAttempt.objects.select_for_update().get(pk=attempt.id)
        if conversation_id:
            current_attempt.conversation_id = conversation_id
            current_payment.payout_conversation_id = conversation_id
        if originator_id:
            current_attempt.originator_conversation_id = originator_id
            current_payment.payout_originator_conversation_id = originator_id

        update_attempt_fields = ['conversation_id', 'originator_conversation_id']
        payment_fields = [
            'payout_conversation_id',
            'payout_originator_conversation_id',
            'updated_at',
        ]
        if response_code != '0' and current_attempt.status == 'PENDING':
            current_attempt.status = 'FAILED'
            current_attempt.result_desc = response_desc
            current_attempt.completed_at = timezone.now()
            current_payment.payout_status = 'FAILED'
            current_payment.payout_error = response_desc
            current_payment.payout_retryable = current_booking.status != 'CANCELLED'
            current_payment.manual_reconciliation_required = current_booking.status == 'CANCELLED'
            update_attempt_fields.extend(['status', 'result_desc', 'completed_at'])
            payment_fields.extend([
                'payout_status',
                'payout_error',
                'payout_retryable',
                'manual_reconciliation_required',
            ])

        current_attempt.save(update_fields=update_attempt_fields)
        current_payment.save(update_fields=payment_fields)
        return current_payment


def _result_parameters(result):
    parameters = result.get('ResultParameters') or {}
    items = parameters.get('ResultParameter', []) if isinstance(parameters, dict) else []
    if isinstance(items, dict):
        items = [items]
    return {
        item.get('Key'): item.get('Value')
        for item in items
        if isinstance(item, dict) and item.get('Key')
    }


def handle_b2c_callback(result, timeout=False):
    conversation_id = str(result.get('ConversationID') or '')
    originator_id = str(result.get('OriginatorConversationID') or '')
    attempt_query = Q()
    if conversation_id:
        attempt_query |= Q(conversation_id=conversation_id)
    if originator_id:
        attempt_query |= Q(originator_conversation_id=originator_id)
    if not attempt_query:
        logger.warning('Received a B2C callback without transaction identifiers.')
        return False

    attempt_info = PayoutAttempt.objects.filter(attempt_query).values(
        'id', 'payment_id'
    ).first()
    if not attempt_info:
        logger.warning('Received a B2C callback for an unknown payout attempt.')
        return False

    with transaction.atomic():
        booking, payment = _lock_payment_and_booking(attempt_info['payment_id'])
        attempt = PayoutAttempt.objects.select_for_update().get(pk=attempt_info['id'])
        now = timezone.now()

        if conversation_id:
            attempt.conversation_id = conversation_id
            payment.payout_conversation_id = conversation_id
        if originator_id:
            attempt.originator_conversation_id = originator_id
            payment.payout_originator_conversation_id = originator_id

        if attempt.status != 'PENDING':
            return True

        if timeout:
            message = str(result.get('ResultDesc') or 'Daraja B2C request timed out; outcome is unknown.')
            attempt.timeout_at = now
            attempt.result_desc = message
            payment.payout_error = message
            payment.manual_reconciliation_required = True
            attempt.save(update_fields=[
                'conversation_id',
                'originator_conversation_id',
                'timeout_at',
                'result_desc',
            ])
            payment.save(update_fields=[
                'payout_conversation_id',
                'payout_originator_conversation_id',
                'payout_error',
                'manual_reconciliation_required',
                'updated_at',
            ])
            return True

        try:
            result_code = int(result.get('ResultCode'))
        except (TypeError, ValueError):
            logger.warning('Received a B2C result callback without a valid result code.')
            return False

        message = str(result.get('ResultDesc') or '')
        attempt.result_code = result_code
        attempt.result_desc = message
        attempt.completed_at = now
        payment.payout_error = message

        if result_code == 0:
            parameters = _result_parameters(result)
            transaction_id = str(
                result.get('TransactionID')
                or parameters.get('TransactionReceipt')
                or parameters.get('TransactionID')
                or ''
            )
            attempt.status = 'PAID'
            attempt.transaction_id = transaction_id
            payment.payout_status = 'PAID'
            payment.payout_reference = transaction_id
            payment.paid_out_at = now
            payment.payout_retryable = False
            payment.manual_reconciliation_required = booking.status == 'CANCELLED'
            if booking.status == 'CANCELLED':
                payment.payout_error = (
                    'Payout completed after booking cancellation; manual reconciliation is required.'
                )
        else:
            attempt.status = 'FAILED'
            payment.payout_status = 'FAILED'
            payment.payout_retryable = booking.status != 'CANCELLED'
            payment.manual_reconciliation_required = booking.status == 'CANCELLED'

        attempt.save(update_fields=[
            'conversation_id',
            'originator_conversation_id',
            'result_code',
            'result_desc',
            'completed_at',
            'status',
            'transaction_id',
        ])
        payment.save(update_fields=[
            'payout_conversation_id',
            'payout_originator_conversation_id',
            'payout_status',
            'payout_reference',
            'paid_out_at',
            'payout_retryable',
            'manual_reconciliation_required',
            'payout_error',
            'updated_at',
        ])
        return True


def flag_booking_payments_for_reconciliation(booking):
    for payment in Payment.objects.select_for_update().filter(
        booking=booking,
        status='SUCCESS',
        is_simulated=False,
        commission_amount__isnull=False,
    ):
        payment.manual_reconciliation_required = True
        if payment.payout_status == 'PENDING' and not payment.payout_attempted_at:
            payment.payout_status = 'FAILED'
        payment.payout_retryable = False
        if payment.payout_status == 'PAID':
            payment.payout_error = (
                'Payout was already completed before cancellation; manual reconciliation is required. '
                'No automatic reversal or refund was issued.'
            )
        elif payment.payout_attempted_at:
            payment.payout_error = (
                'A payout request may already be in progress; manual reconciliation is required. '
                'No automatic reversal or refund was issued.'
            )
        else:
            payment.payout_error = (
                'Booking cancelled before payout initiation; the payout was stopped. '
                'Manual reconciliation is required and no automatic refund was issued.'
            )
        payment.save(update_fields=[
            'payout_status',
            'payout_retryable',
            'manual_reconciliation_required',
            'payout_error',
            'updated_at',
        ])
