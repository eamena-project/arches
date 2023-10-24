define([
    'jquery',
    'knockout',
    'underscore',
    'arches',
    'dropzone',
    'uuid',
    'viewmodels/widget',
    'bindings/dropzone'
], function($, ko, _, arches, Dropzone, uuid, WidgetViewModel) {
    /**
     * A viewmodel used for domain widgets
     *
     * @constructor
     * @name FileWidgetViewModel
     *
     * @param  {string} params - a configuration object
     */
    var FileWidgetViewModel = function(params) {
        var self = this;
        params.configKeys = ['acceptedFiles', 'maxFilesize', 'maxFiles'];

        WidgetViewModel.apply(this, [params]);

        this.uploadMulti = ko.observable(true);
        this.filesForUpload = ko.observableArray();
        this.uploadedFiles = ko.observableArray();
        this.unsupportedImageTypes = ['tif', 'tiff', 'vnd.adobe.photoshop'];


        if (this.form) {
            this.form.on('after-update', function(req, tile) {
                var hasdata = _.filter(tile.data, function(val, key) {
                    val = ko.unwrap(val);
                    if (val) {
                        return val;
                    }
                });
                if (tile.isParent === true || hasdata.length === 0){
                    if (self.dropzone) {
                        self.dropzone.removeAllFiles(true);
                    }
                } else if ((self.tile === tile || _.contains(tile.tiles, self.tile)) && req.status === 200) {
                    if (self.filesForUpload().length > 0) {
                        self.filesForUpload.removeAll();
                    }
                    var data = req.responseJSON.data[self.node.nodeid];
                    if (Array.isArray(data)) {
                        self.uploadedFiles(data);
                    }
                    if (self.dropzone) {
                        self.dropzone.removeAllFiles(true);
                    }
                    self.formData.delete('file-list_' + self.node.nodeid);
                }
            });
            this.form.on('tile-reset', function(tile) {
                if ((self.tile === tile || _.contains(tile.tiles, self.tile))) {
                    if (self.filesForUpload().length > 0) {
                        self.filesForUpload.removeAll();
                    }
                    if (Array.isArray(self.value())) {
                        var uploaded = _.filter(self.value(), function(val) {
                            return ko.unwrap(val.status) === 'uploaded';
                        });
                        self.uploadedFiles(uploaded);
                    }
                    if (self.dropzone) {
                        self.dropzone.removeAllFiles(true);
                        self.formData.delete('file-list_' + self.node.nodeid);
                    }
                }
            });
        }
        this.acceptedFiles.subscribe(function(val) {
            if (self.dropzone) {
                self.dropzone.hiddenFileInput.setAttribute("accept", val);
            }
        });
        this.maxFilesize.subscribe(function(val) {
            if (self.dropzone) {
                self.dropzone.options.maxFilesize = val;
            }
        });

        this.formatSize = function(file) {
            var bytes = ko.unwrap(file.size);
            if(bytes == 0) return '0 Byte';
            var k = 1024;
            var dm = 2;
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return '<span>' + parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + '</span> ' + sizes[i];
        };

        const createStrObject = str => {
            return {[arches.activeLanguage]: {
                "value": str,
                "direction": arches.languages.find(lang => lang.code == arches.activeLanguage).default_direction,
            }};
        };
        this.activeLanguage = arches.activeLanguage;

        this.beforeChangeMetadataSnapshot = ko.observable({});
        this.standaloneObservable = ko.observableArray();

        this.filesJSON = ko.computed(function() {
            var filesForUpload = self.filesForUpload();
            var uploadedFiles = self.uploadedFiles();
            var standaloneObservable = self.standaloneObservable();  // for triggering update
            var beforeChangeMetadataSnapshot = self.beforeChangeMetadataSnapshot();
            return uploadedFiles.concat(
                _.map(filesForUpload, function(file, i) {
                    return {
                        name: file.name,
                        altText: beforeChangeMetadataSnapshot[i]?.altText ?? createStrObject(''),
                        title: beforeChangeMetadataSnapshot[i]?.title ?? createStrObject(''),
                        attribution: beforeChangeMetadataSnapshot[i]?.attribution ?? createStrObject(''),
                        description: beforeChangeMetadataSnapshot[i]?.description ?? createStrObject(''),
                        accepted: file.accepted,
                        height: file.height,
                        lastModified: file.lastModified,
                        size: file.size,
                        status: file.status,
                        type: file.type,
                        width: file.width,
                        url: null,
                        file_id: null,
                        index: i,
                        content: URL.createObjectURL(file),
                        error: file.error
                    };
                })
            );
        }).extend({throttle: 100});

        this.filesJSON.subscribe(function(value) {
            if (self.formData) {
                if (_.contains(self.formData.keys(), 'file-list_' + self.node.nodeid)) {
                    self.formData.delete('file-list_' + self.node.nodeid);
                }
            }
            if (value.length > 1 && self.selectedFile() == undefined) { self.selectedFile(value[0]); }
            _.each(self.filesForUpload(), function(file) {
                if (file.accepted) {
                    self.formData.append('file-list_' + self.node.nodeid, file, file.name);
                }
            });
            if (ko.unwrap(self.value) !== null || self.filesForUpload().length !== 0 || self.uploadedFiles().length !== 0) {
                self.value(
                    value.filter(function(file) {
                        return file.accepted;
                    })
                );
            }
        });

        this.equalMetadata = (a, b) => {
            if (!a || !b) {
                return false;
            }
            return (
                a.altText[this.activeLanguage].value === b.altText[this.activeLanguage].value
                && a.title[this.activeLanguage].value === b.title[this.activeLanguage].value
                && a.attribution[this.activeLanguage].value === b.title[this.activeLanguage].value
                && a.description[this.activeLanguage].value === b.title[this.activeLanguage].value
            );
        }

        this.metadataIsEmpty = (metadata) => {
            return !metadata.altText[this.activeLanguage].value
                && !metadata.title[this.activeLanguage].value
                && !metadata.attribution[this.activeLanguage].value
                && !metadata.description[this.activeLanguage].value
        };

        this.filesJSON.subscribe(function(value) {
            // Preserve current metadata for yet-to-be-uploaded files
            value.filter(file => file.file_id === null).forEach((file, i) => {
                const { altText, title, attribution, description } = file;
                const metadata = { altText, title, attribution, description };
                if (self.metadataIsEmpty(metadata)) {
                    return;
                }
                if (!self.equalMetadata(self.beforeChangeMetadataSnapshot()[i], metadata)) {
                    self.beforeChangeMetadataSnapshot()[i] = metadata;
                    self.standaloneObservable.push(Math.random());
                }
            });
        }, this, 'beforeChange');

        this.getFileUrl = function(url){
            url = ko.unwrap(url);
            var httpRegex = /^https?:\/\//;
            // test whether the url is external (starts with http(s), if it is just return it)
            if (httpRegex.test(url)){
                return url;
            }else{
                return (arches.urls.url_subpath + url).replace('//', '/');
            }

        };

        if (Array.isArray(self.value())) {
            // Hydrate the metadata fields in place with the active language keys if missing
            const vals = self.value();
            vals.forEach(val => {
                Object.values(val).filter(innerVal => typeof innerVal === 'object').forEach(i18nObj => {
                    if (i18nObj[arches.activeLanguage] === undefined) {
                        i18nObj[arches.activeLanguage] = createStrObject('')[arches.activeLanguage];
                    }
                });
            });
            this.uploadedFiles(vals);
        }
        this.filter = ko.observable("");
        this.filteredList = ko.computed(function() {
            var arr = [], lowerName = "", filter = self.filter().toLowerCase();
            if(filter) {
                self.filesJSON().forEach(function(f, i) {
                    lowerName = ko.unwrap(f.name).toLowerCase();
                    if(lowerName.includes(filter)) { arr.push(self.filesJSON()[i]); }
                });
            }
            return arr;
        });

        this.selectedFile = ko.observable(self.filesJSON()[0]);
        this.selectFile = function(sFile) { self.selectedFile(sFile); };

        this.removeFile = function(file) {
            var filePosition;
            self.filesJSON().forEach(function(f, i) { if (f.file_id === file.file_id) { filePosition = i; } });
            self.shiftMetadata(filePosition);
            var newfilePosition = filePosition === 0 ? 1 : filePosition - 1;
            var filesForUpload = self.filesForUpload();
            var uploadedFiles = self.uploadedFiles();
            if (file.file_id) {
                file = _.find(uploadedFiles, function(uploadedFile) {
                    return ko.unwrap(file.file_id) === ko.unwrap(uploadedFile.file_id);
                });
                self.uploadedFiles.remove(file);
            } else {
                file = filesForUpload[file.index];
                self.filesForUpload.remove(file);
            }
            if (self.filesJSON().length > 0) { self.selectedFile(self.filesJSON()[newfilePosition]); }
        };
        
        this.pageCt = ko.observable(5);
        this.pageCtReached = ko.computed(function() {
            return (self.filesJSON().length > self.pageCt() ? 'visible' : 'hidden');
        });

        this.pagedList = function(list) {
            var arr = [], i = 0;
            if(list.length > self.pageCt()) {
                while(arr.length < self.pageCt()) { arr.push(list[i++]); }
                return arr;
            }
            return list;
        };

        this.unique_id = uuid.generate();
        this.uniqueidClass = ko.computed(function() {
            return "unique_id_" + self.unique_id;
        });

        // metadata drawer toggles. 0-indexed. true = expanded
        this.metadataToggles = ko.observable({});
        this.shouldIgnoreToggleAction = false;
        this.toggleDropdown = (index) => {
            // dz emits clicks for each uploaded file; we need to ignore those.
            if (this.shouldIgnoreToggleAction) {
                if (index === this.uploadedFiles().length + this.filesForUpload().length - 1) {
                    // Last click emitted by dz: reset variable
                    this.shouldIgnoreToggleAction = false;
                } // else: noop
            } else {
                const oldValue = self.metadataToggles()[index];
                self.metadataToggles({
                    ...self.metadataToggles(),
                    [index]: oldValue === undefined ? false : !oldValue,
                });
            }
        };

        self.shiftMetadata = function(filePosition) {
            const newToggles = {};
            for (const [key, val] of Object.entries(self.metadataToggles())) {
                const keyAsInt = Number.parseInt(key);
                if (keyAsInt < filePosition) {
                    newToggles[keyAsInt] = val;
                } else if (keyAsInt !== filePosition) {
                    newToggles[keyAsInt - 1] = val;
                }
            }
            self.metadataToggles(newToggles);

            const newMetadata = {};
            for (const [key, val] of Object.entries(self.beforeChangeMetadataSnapshot())) {
                const keyAsInt = Number.parseInt(key);
                if (keyAsInt < filePosition) {
                    newMetadata[keyAsInt] = val;
                } else if (keyAsInt !== filePosition) {
                    newMetadata[keyAsInt - 1] = val;
                }
            }
            self.beforeChangeMetadataSnapshot(newMetadata);
        }

        this.dropzoneOptions = {
            url: "arches.urls.root",
            dictDefaultMessage: '',
            autoProcessQueue: false,
            previewTemplate: $("template#file-widget-dz-preview").html(),
            autoQueue: false,
            previewsContainer: ".dz-previews." + this.uniqueidClass(),
            clickable: ".fileinput-button." + this.uniqueidClass(),
            acceptedFiles: this.acceptedFiles(),
            maxFilesize: this.maxFilesize(),
            uploadMultiple: self.uploadMulti(),
            // maxFiles: Number(this.maxFiles()),
            init: function() {
                self.dropzone = this;

                this.on("addedfile", function(file) {
                    self.filesForUpload.push(file);
                    self.shouldIgnoreToggleAction = true;
                    self.metadataToggles()[Object.keys(self.metadataToggles()).length] = false;
                });

                this.on("error", function(file, error) {
                    file.error = error;
                    self.filesForUpload.valueHasMutated();
                });

                this.on("removedfile", function(file) {
                    self.filesForUpload.remove(file);
                    // "removedfile" action only reachable via "Delete all files"
                    // so just clear all the toggle states.
                    self.metadataToggles({});
                });
            }
        };

        this.reset = function() {
            if (self.dropzone) {
                self.dropzone.removeAllFiles(true);
                self.uploadedFiles.removeAll();
                self.filesForUpload.removeAll();
                self.metadataToggles({});
            }
        };

        this.displayValue = ko.computed(function() {
            return self.uploadedFiles().length === 1 ? ko.unwrap(self.uploadedFiles()[0].name) : self.uploadedFiles().length; 
        });

        this.reportFiles = ko.computed(function() {
            return self.uploadedFiles().filter(function(file) {
                var fileType = ko.unwrap(file.type);
                if (fileType) {
                    var ext = fileType.split('/').pop();
                    return fileType.indexOf('image') < 0 || self.unsupportedImageTypes.indexOf(ext) > -1;
                }
                return true;
            });
        });

        this.reportImages = ko.computed(function() {
            return self.uploadedFiles().filter(function(file) {
                var fileType = ko.unwrap(file.type);
                if (fileType) {
                    var ext = fileType.split('/').pop();
                    return fileType.indexOf('image') >= 0 && self.unsupportedImageTypes.indexOf(ext) <= 0;
                }
                return false;
            });
        });
    };

    return FileWidgetViewModel;
});
