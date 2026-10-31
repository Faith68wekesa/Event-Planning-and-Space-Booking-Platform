"""
Standalone Admin Seeder Script
Run with: python seed_admin.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from core.models import User

email = os.getenv('ADMIN_EMAIL')
password = os.getenv('ADMIN_PASSWORD')
if not email or not password:
    raise RuntimeError('ADMIN_EMAIL and ADMIN_PASSWORD must be configured in the environment.')

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
print(f"[{status_str}] Admin user: {email}")

print("Administrator account is provisioned.")
