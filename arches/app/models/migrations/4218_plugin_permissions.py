# -*- coding: utf-8 -*-
# Generated by Django 1.11.14 on 2018-10-23 11:38


from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("models", "4217_plugin_slug"),
    ]

    operations = [
        migrations.AlterModelOptions(name="plugin", options={"managed": True, "permissions": (("view_plugin", "View plugin"),)},),
    ]
