from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0031_payment_commission_amount_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='booking',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='core.booking',
            ),
        ),
        migrations.AddField(
            model_name='notification',
            name='source_message',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notifications',
                to='core.message',
            ),
        ),
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('CHECKLIST_REMINDER', 'Checklist Reminder'),
                    ('BOOKING_UPDATE', 'Booking Update'),
                    ('LISTING_AVAILABILITY', 'Listing Availability'),
                    ('MESSAGE', 'Message'),
                    ('SYSTEM', 'System Alert'),
                ],
                default='CHECKLIST_REMINDER',
                max_length=50,
            ),
        ),
    ]
