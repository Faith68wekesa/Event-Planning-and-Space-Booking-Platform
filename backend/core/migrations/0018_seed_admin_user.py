from django.db import migrations
from django.contrib.auth.hashers import make_password


def seed_admin_user(apps, schema_editor):
    User = apps.get_model('core', 'User')

    admins = [
        ('admin@locyfy.com', 'Admin@Locyfy2026!'),
        ('muchiri.mugo22@students.dkut.ac.ke', 'Admin@Locyfy2026!'),
    ]

    for email, password in admins:
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                'email': email,
                'role': 'ADMIN',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
                'is_customer': True,
                'is_vendor': False,
                'is_venue_owner': False,
                'password': make_password(password),
            }
        )

        if not created:
            user.email = email
            user.role = 'ADMIN'
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.password = make_password(password)
            user.save()


def reverse_seed_admin_user(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_alter_verificationdocument_file'),
    ]

    operations = [
        migrations.RunPython(seed_admin_user, reverse_seed_admin_user),
    ]
