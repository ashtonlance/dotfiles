"use strict";
var vscode_1 = require('vscode');
function isInString(text, character) {
    var inSingleQuoationString = (text.substring(0, character).match(/\'/g) || []).length % 2 === 1;
    var inDoubleQuoationString = (text.substring(0, character).match(/\"/g) || []).length % 2 === 1;
    return inSingleQuoationString || inDoubleQuoationString;
}
exports.isInString = isInString;
function isImportOrRequire(text) {
    var isImport = text.substring(0, 6) === 'import';
    var isRequire = text.indexOf('require(') != -1;
    return isImport || isRequire;
}
exports.isImportOrRequire = isImportOrRequire;
function getTextWithinString(text, position) {
    var textToPosition = text.substring(0, position);
    var quoatationPosition = Math.max(textToPosition.lastIndexOf('\"'), textToPosition.lastIndexOf('\''));
    return quoatationPosition != -1 ? textToPosition.substring(quoatationPosition + 1, textToPosition.length) : undefined;
}
exports.getTextWithinString = getTextWithinString;
function importStringRange(line, position) {
    var textToPosition = line.substring(0, position.character);
    var slashPosition = textToPosition.lastIndexOf('/');
    var startPosition = new vscode_1.Position(position.line, slashPosition + 1);
    var endPosition = position;
    return new vscode_1.Range(startPosition, endPosition);
}
exports.importStringRange = importStringRange;
//# sourceMappingURL=text-parser.js.map