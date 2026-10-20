"""
Standalone Admin Seeder Script
Run with: python seed_admin.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import User

admins = [
    ('admin@locyfy.com', 'Admin@Locyfy2026!'),
    ('muchiri.mugo22@students.dkut.ac.ke', 'Admin@Locyfy2026!'),
]

for email, password in admins:
    user, created = User.objects.get_or_create(
        username=email,
        defaults={'email': email}
    )
    user.email = email
    user.set_password(password)
    user.role = 'ADMIN'
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.is_customer = True
    user.save()
    status_str = "Created" if created else "Updated"
    print(f"[{status_str}] Admin user: {email} (Password: {password})")

print("\nAll administrator accounts are provisioned and ready for login.")
