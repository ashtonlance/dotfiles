// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const cordovaDebugAdapter_1 = require("./cordovaDebugAdapter");
const cordovaPathTransformer_1 = require("./cordovaPathTransformer");
vscode_chrome_debug_core_1.ChromeDebugSession.run(vscode_chrome_debug_core_1.ChromeDebugSession.getSession({
    adapter: cordovaDebugAdapter_1.CordovaDebugAdapter,
    extensionName: 'cordova-tools',
    pathTransformer: cordovaPathTransformer_1.CordovaPathTransformer,
    sourceMapTransformer: vscode_chrome_debug_core_1.BaseSourceMapTransformer
}));

//# sourceMappingURL=debugCordova.js.map
