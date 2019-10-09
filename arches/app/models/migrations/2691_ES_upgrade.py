# -*- coding: utf-8 -*-
# Generated by Django 1.11.15 on 2019-02-07 15:17


from django.db import migrations, models
from arches.app.models.system_settings import settings
from arches.app.search.search_engine_factory import SearchEngineFactory
from arches.app.search.mappings import prepare_terms_index, delete_terms_index, \
    prepare_concepts_index, delete_concepts_index, prepare_search_index, delete_search_index

class Migration(migrations.Migration):

    dependencies = [
        ('models', '4658_adds_nodevalue_type_widget_config'),
    ]

    def forwards_func(apps, schema_editor):
        se = SearchEngineFactory().create()
        prefix = settings.ELASTICSEARCH_PREFIX

        if(se.es.indices.exists(index="%s_strings" % prefix)):
            prepare_terms_index(create=True)
            doc = {
                "source": {
                    "index": "%s_strings" % prefix,
                    "type": "term"
                },
                "dest": {
                    "index": "%s_terms" % prefix,
                    "type": "_doc"
                }
            }
            se.es.reindex(body=doc)

            prepare_concepts_index(create=True)
            doc = {
                "source": {
                    "index": "%s_strings" % prefix,
                    "type": "concept"
                },
                "dest": {
                    "index": "%s_concepts" % prefix,
                    "type": "_doc"
                }
            }
            se.es.reindex(body=doc)

        if(se.es.indices.exists(index="%s_resource" % prefix)):
            prepare_search_index(create=True)
            doc = {
                "source": {
                    "index": "%s_resource" % prefix
                },
                "dest": {
                    "index": "%s_resources" % prefix,
                    "type": "_doc"
                }
            }
            se.es.reindex(body=doc)

    def reverse_func(apps, schema_editor):
        delete_terms_index()
        delete_concepts_index()
        delete_search_index()

    operations = [
        migrations.RunPython(forwards_func, reverse_func),
    ]
