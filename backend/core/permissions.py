from rest_framework.permissions import BasePermission


class IsAuthenticatedCustomer(BasePermission):
    """
    Require an authenticated customer to create bookings.
    """

    message = "Only authenticated customers can create bookings."

    def has_permission(self, request, view):
        if getattr(view, 'action', None) != 'create':
            return True

        user = request.user

        return (
            user.is_authenticated
            and user.role == 'CUSTOMER'
            and user.is_customer is True
        )
