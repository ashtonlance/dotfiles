"use strict";
var text_parser_1 = require('./text-parser');
var fs_functions_1 = require('./fs-functions');
var PathCompletionItem_1 = require('./PathCompletionItem');
var UpCompletionItem_1 = require('./UpCompletionItem');
var config_1 = require('./config');
var PathIntellisense = (function () {
    function PathIntellisense(getChildrenOfPath) {
        this.getChildrenOfPath = getChildrenOfPath;
    }
    PathIntellisense.prototype.provideCompletionItems = function (document, position) {
        var textCurrentLine = document.getText(document.lineAt(position).range);
        var state = {
            config: config_1.getConfig(),
            fileName: document.fileName,
            textCurrentLine: textCurrentLine,
            textWithinString: text_parser_1.getTextWithinString(textCurrentLine, position.character),
            importRange: text_parser_1.importStringRange(textCurrentLine, position),
            isImport: text_parser_1.isImportOrRequire(textCurrentLine),
            documentExtension: fs_functions_1.extractExtension(document)
        };
        return this.shouldProvide(state) ? this.provide(state) : Promise.resolve([]);
    };
    PathIntellisense.prototype.shouldProvide = function (state) {
        var typedAnything = state.textWithinString && state.textWithinString.length > 0;
        var startsWithDot = typedAnything && state.textWithinString[0] === '.';
        var startsWithMapping = state.config.mappings.some(function (mapping) { return state.textWithinString.indexOf(mapping.key) === 0; });
        if (state.isImport && (startsWithDot || startsWithMapping)) {
            return true;
        }
        if (!state.isImport && typedAnything) {
            return true;
        }
        return false;
    };
    PathIntellisense.prototype.provide = function (state) {
        var path = fs_functions_1.getPath(state.fileName, state.textWithinString, state.config.mappings);
        return this.getChildrenOfPath(path).then(function (children) { return ([
            new UpCompletionItem_1.UpCompletionItem()
        ].concat(children.map(function (child) { return new PathCompletionItem_1.PathCompletionItem(child, state.importRange, state.isImport, state.documentExtension, state.config); }))); });
    };
    return PathIntellisense;
}());
exports.PathIntellisense = PathIntellisense;
//# sourceMappingURL=PathIntellisense.js.map