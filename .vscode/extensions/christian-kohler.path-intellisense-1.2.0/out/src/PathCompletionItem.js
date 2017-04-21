"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var vscode_1 = require('vscode');
var vscode_2 = require('vscode');
var withExtension = vscode_2.workspace.getConfiguration('path-intellisense')['extensionOnImport'];
var PathCompletionItem = (function (_super) {
    __extends(PathCompletionItem, _super);
    function PathCompletionItem(fileInfo, importRange, isImport, documentExtension, config) {
        _super.call(this, fileInfo.file);
        this.kind = vscode_1.CompletionItemKind.File;
        this.addGroupByFolderFile(fileInfo);
        this.removeExtension(fileInfo, isImport, documentExtension, importRange);
        this.addSlashForFolder(fileInfo, importRange, config.autoSlash);
    }
    PathCompletionItem.prototype.addGroupByFolderFile = function (fileInfo) {
        this.sortText = (fileInfo.isFile ? 'b' : 'a') + "_" + fileInfo.file;
    };
    PathCompletionItem.prototype.addSlashForFolder = function (fileInfo, importRange, autoSlash) {
        if (!fileInfo.isFile) {
            this.label = fileInfo.file + "/";
            var newText = autoSlash ? fileInfo.file + "/" : "" + fileInfo.file;
            this.textEdit = new vscode_1.TextEdit(importRange, newText);
        }
    };
    PathCompletionItem.prototype.removeExtension = function (fileInfo, isImport, documentExtension, importRange) {
        if (!fileInfo.isFile || withExtension || !isImport) {
            return;
        }
        var fragments = fileInfo.file.split('.');
        var extension = fragments[fragments.length - 1];
        if (extension !== documentExtension) {
            return;
        }
        var index = fileInfo.file.lastIndexOf('.');
        var newText = index != -1 ? fileInfo.file.substring(0, index) : fileInfo.file;
        this.textEdit = new vscode_1.TextEdit(importRange, newText);
    };
    return PathCompletionItem;
}(vscode_1.CompletionItem));
exports.PathCompletionItem = PathCompletionItem;
//# sourceMappingURL=PathCompletionItem.js.map