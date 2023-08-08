define([
    'underscore',
    'knockout',
    'viewmodels/base-import-view-model',
    'arches',
    'viewmodels/alert',
    'viewmodels/excel-file-import',
    'templates/views/components/etl_modules/tile-excel.htm',
    'dropzone',
    'bindings/select2-query',
    'bindings/dropzone',
], function(_, ko, ImporterViewModel, arches, AlertViewModel, ExcelFileImportViewModel, tileExcelImporterTemplate) {
    return ko.components.register('tile-excel', {
        viewModel: ExcelFileImportViewModel,
        template: tileExcelImporterTemplate,
    });
});
