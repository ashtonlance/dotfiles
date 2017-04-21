"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode_1 = require('vscode');
var path = require("path");
var Glob = require("glob");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    var relativePath = new RelativePath();
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var disposable = vscode_1.commands.registerCommand("extension.relativePath", function () {
        // The code you place here will be executed every time your command is executed
        relativePath.findRelativePath();
    });
    context.subscriptions.push(relativePath);
    context.subscriptions.push(disposable);
}
exports.activate = activate;
var RelativePath = (function () {
    function RelativePath() {
        this._items = null;
        this._pausedSearch = null;
        this._myGlob = null;
        this._workspacePath = vscode_1.workspace.rootPath.replace(/\\/g, "/");
        this._configuration = vscode_1.workspace.getConfiguration("relativePath");
        this.initializeWatcher();
        this.searchWorkspace();
        this.initializeConfigWatcher();
    }
    // When a file is added or deleted, we need to update cache
    RelativePath.prototype.initializeWatcher = function () {
        var _this = this;
        // Watch for file system changes - as we're caching the searched files
        this._watcher = vscode_1.workspace.createFileSystemWatcher("**/*.*", false, true, false);
        // Add a file on creation
        this._watcher.onDidCreate(function (e) {
            _this._items.push(e.fsPath.replace(/\\/g, "/"));
        });
        // Remove a file on deletion
        this._watcher.onDidDelete(function (e) {
            var item = e.fsPath.replace(/\\/g, "/");
            var index = _this._items.indexOf(item);
            if (index > -1) {
                _this._items.splice(index, 1);
            }
        });
    };
    // Purely updates the files
    RelativePath.prototype.updateFiles = function (skipOpen) {
        var _this = this;
        if (skipOpen === void 0) { skipOpen = false; }
        // Search for files
        if (this._pausedSearch) {
            this._pausedSearch = false;
            if (this._myGlob) {
                this._myGlob.resume();
            }
        }
        else {
            this._myGlob = new Glob(this._workspacePath + "/**/*.*", { ignore: this._configuration.get("ignore") }, function (err, files) {
                if (err) {
                    return;
                }
                _this._items = files;
                if (!skipOpen) {
                    _this.findRelativePath();
                }
            });
            this._myGlob.on("end", function () {
                _this._pausedSearch = false;
            });
        }
    };
    // Go through workspace to cache files
    RelativePath.prototype.searchWorkspace = function (skipOpen) {
        var _this = this;
        if (skipOpen === void 0) { skipOpen = false; }
        var emptyItem = { label: "", description: "No files found" };
        // Show loading info box
        var info = vscode_1.window.showQuickPick([emptyItem], { matchOnDescription: false, placeHolder: "Finding files... Please wait. (Press escape to cancel)" });
        info.then(function (value) {
            if (_this._myGlob) {
                _this._myGlob.pause();
            }
            if (_this._pausedSearch === null) {
                _this._pausedSearch = true;
            }
        }, function (rejected) {
            if (_this._myGlob) {
                _this._myGlob.pause();
            }
            if (_this._pausedSearch === null) {
                _this._pausedSearch = true;
            }
        });
        this.updateFiles(skipOpen);
    };
    // Compares the ignore property of _configuration to lastConfig
    RelativePath.prototype.ignoreWasUpdated = function (currentIgnore, lastIgnore) {
        if (currentIgnore.length !== lastIgnore.length) {
            return true;
        }
        else if (currentIgnore.some(function (glob) { return lastIgnore.indexOf(glob) < 0; })) {
            return true;
        }
        return false;
    };
    // Listen for changes in the config files and update the config object
    RelativePath.prototype.initializeConfigWatcher = function () {
        var _this = this;
        vscode_1.workspace.onDidChangeConfiguration(function (e) {
            var lastConfig = _this._configuration;
            _this._configuration = vscode_1.workspace.getConfiguration("relativePath");
            // Handle updates to the ignored property if there's one
            if (_this.ignoreWasUpdated(_this._configuration.ignore, lastConfig.ignore)) {
                _this.updateFiles(true);
            }
        }, this);
    };
    // Show dropdown editor
    RelativePath.prototype.showQuickPick = function (items, editor) {
        var _this = this;
        if (items) {
            var paths = items.map(function (val) {
                var item = { description: val.replace(_this._workspacePath, ""), label: val.split("/").pop() };
                return item;
            });
            var pickResult = void 0;
            pickResult = vscode_1.window.showQuickPick(paths, { matchOnDescription: true, placeHolder: "Filename" });
            pickResult.then(function (item) { return _this.returnRelativeLink(item, editor); });
        }
        else {
            vscode_1.window.showInformationMessage("No files to show.");
        }
    };
    // Check if the current extension should be excluded
    RelativePath.prototype.excludeExtensionsFor = function (relativeUrl) {
        var currentExtension = path.extname(relativeUrl);
        if (currentExtension === '') {
            return false;
        }
        return this._configuration.excludedExtensions.some(function (ext) {
            return (ext.startsWith('.') ? ext : "." + ext).toLowerCase() === currentExtension.toLowerCase();
        });
    };
    // Get the picked item
    RelativePath.prototype.returnRelativeLink = function (item, editor) {
        if (item) {
            var targetPath = item.description;
            var currentItemPath = editor.document.fileName.replace(/\\/g, "/").replace(this._workspacePath, "");
            var relativeUrl_1 = path.relative(currentItemPath, targetPath).replace(".", "").replace(/\\/g, "/");
            if (this._configuration.removeExtension) {
                relativeUrl_1 = relativeUrl_1.substring(0, relativeUrl_1.lastIndexOf("."));
            }
            else if (this.excludeExtensionsFor(relativeUrl_1)) {
                relativeUrl_1 = relativeUrl_1.substring(0, relativeUrl_1.lastIndexOf("."));
            }
            if (this._configuration.removeLeadingDot && relativeUrl_1.startsWith("./../")) {
                relativeUrl_1 = relativeUrl_1.substring(2, relativeUrl_1.length);
            }
            vscode_1.window.activeTextEditor.edit(function (editBuilder) {
                var position = vscode_1.window.activeTextEditor.selection.end;
                editBuilder.insert(position, relativeUrl_1);
            });
        }
    };
    RelativePath.prototype.findRelativePath = function () {
        // If there's no file opened
        var editor = vscode_1.window.activeTextEditor;
        if (!editor) {
            vscode_1.window.showInformationMessage("You need to have a file opened.");
            return; // No open text editor
        }
        // If we canceled the file search
        if (this._pausedSearch) {
            this.searchWorkspace();
            return;
        }
        // If there are no items found
        if (!this._items) {
            return;
        }
        this.showQuickPick(this._items, editor);
    };
    RelativePath.prototype.dispose = function () {
        this._items = null;
    };
    return RelativePath;
}());
//# sourceMappingURL=extension.js.map