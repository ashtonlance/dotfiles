"use strict";
var vscode_1 = require('vscode');
function getConfig() {
    var configuration = vscode_1.workspace.getConfiguration('path-intellisense');
    return {
        autoSlash: configuration['autoSlashAfterDirectory'],
        mappings: getMappings(configuration)
    };
}
exports.getConfig = getConfig;
function getMappings(configuration) {
    var mappings = configuration['mappings'];
    return Object.keys(mappings)
        .map(function (key) { return ({ key: key, value: mappings[key] }); })
        .filter(function (mapping) { return !!vscode_1.workspace.rootPath || mapping.value.indexOf('${workspaceRoot}') === -1; })
        .map(function (mapping) { return ({ key: mapping.key, value: mapping.value.replace('${workspaceRoot}', vscode_1.workspace.rootPath) }); });
}
//# sourceMappingURL=config.js.map