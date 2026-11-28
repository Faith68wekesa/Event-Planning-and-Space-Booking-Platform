from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_notification_activity_links'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='target_tab',
            field=models.CharField(blank=True, default='', max_length=32),
        ),
    ]
