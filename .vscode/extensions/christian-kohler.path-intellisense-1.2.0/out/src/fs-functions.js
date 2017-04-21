"use strict";
var fs_1 = require('fs');
var path_1 = require('path');
var FileInfo_1 = require('./FileInfo');
var vscode_1 = require('vscode');
function getChildrenOfPath(path) {
    return readdirPromise(path)
        .then(function (files) { return files.filter(notHidden).map(function (f) { return new FileInfo_1.FileInfo(path, f); }); })
        .catch(function () { return []; });
}
exports.getChildrenOfPath = getChildrenOfPath;
function getPath(fileName, text, mappings) {
    var mapping = mappings && mappings.reduce(function (prev, curr) {
        return prev || (path_1.normalize(text).indexOf(curr.key) === 0 && curr);
    }, undefined);
    var referencedFolder = mapping ? mapping.value : fileName.substring(0, fileName.lastIndexOf(path_1.sep));
    var lastFolderInText = path_1.normalize(text).substring(0, path_1.normalize(text).lastIndexOf(path_1.sep));
    var pathInText = mapping ? "." + lastFolderInText.substring(mapping.key.length, lastFolderInText.length) : lastFolderInText;
    return path_1.resolve(referencedFolder, pathInText);
}
exports.getPath = getPath;
function extractExtension(document) {
    if (document.isUntitled) {
        return undefined;
    }
    var fragments = document.fileName.split('.');
    var extension = fragments[fragments.length - 1];
    if (!extension || extension.length > 3) {
        return undefined;
    }
    return extension;
}
exports.extractExtension = extractExtension;
function readdirPromise(path) {
    return new Promise(function (resolve, reject) {
        fs_1.readdir(path, function (error, files) {
            if (error) {
                reject(error);
            }
            else {
                resolve(files);
            }
        });
    });
}
function notHidden(filename) {
    var showHiddenFiles = vscode_1.workspace.getConfiguration('path-intellisense')['showHiddenFiles'];
    return showHiddenFiles || filename[0] !== '.';
}
//# sourceMappingURL=fs-functions.js.map