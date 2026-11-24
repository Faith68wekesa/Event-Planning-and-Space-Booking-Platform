from django.db import migrations, models


def classify_existing_listings(apps, schema_editor):
    Venue = apps.get_model('core', 'Venue')
    service_categories = {
        'PHOTOGRAPHY',
        'CATERING',
        'DECORATION',
        'ENTERTAINMENT',
        'PLANNING',
        'SOUND',
    }

    for venue in Venue.objects.all().iterator():
        if (
            venue.vendor_id is not None
            or venue.category in service_categories
            or venue.capacity == 0
        ):
            venue.listing_type = 'SERVICE'
        else:
            venue.listing_type = 'VENUE'
        venue.save(update_fields=['listing_type'])


def reset_listing_types(apps, schema_editor):
    Venue = apps.get_model('core', 'Venue')
    Venue.objects.update(listing_type='VENUE')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_alter_fraudalert_detection_method'),
    ]

    operations = [
        migrations.AddField(
            model_name='venue',
            name='listing_type',
            field=models.CharField(
                choices=[('VENUE', 'Venue'), ('SERVICE', 'Service')],
                db_index=True,
                default='VENUE',
                max_length=10,
            ),
        ),
        migrations.RunPython(
            classify_existing_listings,
            reverse_code=reset_listing_types,
        ),
    ]
