// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const os = require("os");
const path = require("path");
function settingsHome() {
    switch (os.platform()) {
        case 'win32':
            return path.join(process.env['APPDATA'], 'vscode-cordova');
        case 'darwin':
        case 'linux':
            return path.join(process.env['HOME'], '.vscode-cordova');
        default:
            throw new Error('UnexpectedPlatform');
    }
    ;
}
exports.settingsHome = settingsHome;

//# sourceMappingURL=settingsHelper.js.map
