from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_alter_verificationdocument_file'),
    ]

    operations = [
        migrations.RunPython(migrations.RunPython.noop),
    ]
