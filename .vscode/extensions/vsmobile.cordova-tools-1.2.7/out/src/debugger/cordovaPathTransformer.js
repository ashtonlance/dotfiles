// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const vscode_chrome_debug_core_2 = require("vscode-chrome-debug-core");
const path = require("path");
const fs = require("fs");
/**
 * Converts a local path from Code to a path on the target.
 */
class CordovaPathTransformer extends vscode_chrome_debug_core_2.BasePathTransformer {
    constructor(outputLogger) {
        super();
        this._clientPathToWebkitUrl = new Map();
        this._webkitUrlToClientPath = new Map();
        this._shadowedClientPaths = new Map();
        this._pendingBreakpointsByPath = new Map();
        this._outputLogger = outputLogger;
        global.cordovaPathTransformer = this;
    }
    launch(args) {
        return this.attach(args);
    }
    attach(args) {
        this._cordovaRoot = args.cwd;
        this._platform = args.platform.toLowerCase();
        this._webRoot = args.webRoot || this._cordovaRoot;
        return;
    }
    setBreakpoints(args) {
        return new Promise((resolve, reject) => {
            if (!args.source.path) {
                resolve();
                return;
            }
            if (vscode_chrome_debug_core_1.utils.isURL(args.source.path)) {
                // already a url, use as-is
                vscode_chrome_debug_core_1.logger.log(`Paths.setBP: ${args.source.path} is already a URL`);
                resolve();
                return;
            }
            const url = vscode_chrome_debug_core_1.utils.canonicalizeUrl(args.source.path);
            if (this._clientPathToWebkitUrl.has(url)) {
                args.source.path = this._clientPathToWebkitUrl.get(url);
                vscode_chrome_debug_core_1.logger.log(`Paths.setBP: Resolved ${url} to ${args.source.path}`);
                resolve();
            }
            else if (this._shadowedClientPaths.has(url)) {
                this._outputLogger(`Warning: Breakpoint set in overriden file ${url} will not be hit. Use ${this._shadowedClientPaths.get(url)} instead.`, true);
                reject();
            }
            else {
                vscode_chrome_debug_core_1.logger.log(`Paths.setBP: No target url cached for client path: ${url}, waiting for target script to be loaded.`);
                args.source.path = url;
                this._pendingBreakpointsByPath.set(args.source.path, { resolve, reject, args });
            }
        });
    }
    clearClientContext() {
        this._pendingBreakpointsByPath = new Map();
    }
    clearTargetContext() {
        this._clientPathToWebkitUrl = new Map();
        this._webkitUrlToClientPath = new Map();
        this._shadowedClientPaths = new Map();
    }
    scriptParsed(scriptPath) {
        const webkitUrl = scriptPath;
        const clientPath = this.getClientPath(webkitUrl);
        if (!clientPath) {
            vscode_chrome_debug_core_1.logger.log(`Paths.scriptParsed: could not resolve ${webkitUrl} to a file in the workspace. webRoot: ${this._webRoot}`);
        }
        else {
            vscode_chrome_debug_core_1.logger.log(`Paths.scriptParsed: resolved ${webkitUrl} to ${clientPath}. webRoot: ${this._webRoot}`);
            this._clientPathToWebkitUrl.set(clientPath, webkitUrl);
            this._webkitUrlToClientPath.set(webkitUrl, clientPath);
            scriptPath = clientPath;
        }
        if (this._pendingBreakpointsByPath.has(scriptPath)) {
            vscode_chrome_debug_core_1.logger.log(`Paths.scriptParsed: Resolving pending breakpoints for ${scriptPath}`);
            const pendingBreakpoint = this._pendingBreakpointsByPath.get(scriptPath);
            this._pendingBreakpointsByPath.delete(scriptPath);
            this.setBreakpoints(pendingBreakpoint.args).then(pendingBreakpoint.resolve, pendingBreakpoint.reject);
        }
        return scriptPath;
    }
    stackTraceResponse(response) {
        response.stackFrames.forEach(frame => {
            if (frame.source.path) {
                // Try to resolve the url to a path in the workspace. If it's not in the workspace,
                // just use the script.url as-is. It will be resolved or cleared by the SourceMapTransformer.
                const clientPath = this._webkitUrlToClientPath.has(frame.source.path) ?
                    this._webkitUrlToClientPath.get(frame.source.path) :
                    this.getClientPath(frame.source.path);
                // Incoming stackFrames have sourceReference and path set. If the path was resolved to a file in the workspace,
                // clear the sourceReference since it's not needed.
                if (clientPath) {
                    frame.source.path = clientPath;
                    frame.source.sourceReference = 0;
                }
            }
        });
    }
    getClientPath(sourceUrl) {
        let wwwRoot = path.join(this._cordovaRoot, 'www');
        // Given an absolute file:/// (such as from the iOS simulator) vscode-chrome-debug's
        // default behavior is to use that exact file, if it exists. We don't want that,
        // since we know that those files are copies of files in the local folder structure.
        // A simple workaround for this is to convert file:// paths to bogus http:// paths
        sourceUrl = sourceUrl.replace('file:///', 'http://localhost/');
        // Find the mapped local file. Try looking first in the user-specified webRoot, then in the project root, and then in the www folder
        let defaultPath = '';
        [this._webRoot, this._cordovaRoot, wwwRoot].find((searchFolder) => {
            let mappedPath = vscode_chrome_debug_core_1.chromeUtils.targetUrlToClientPath(searchFolder, sourceUrl);
            if (mappedPath) {
                defaultPath = mappedPath;
                return true;
            }
            return false;
        });
        if (defaultPath.toLowerCase().indexOf(wwwRoot.toLowerCase()) === 0) {
            // If the path appears to be in www, check to see if it exists in /merges/<platform>/<relative path>
            let relativePath = path.relative(wwwRoot, defaultPath);
            let mergesPath = path.join(this._cordovaRoot, 'merges', this._platform, relativePath);
            if (fs.existsSync(mergesPath)) {
                // This file is overriden by a merge: Use that one
                if (fs.existsSync(defaultPath)) {
                    this._shadowedClientPaths.set(defaultPath, mergesPath);
                    if (this._pendingBreakpointsByPath.has(defaultPath)) {
                        this._outputLogger(`Warning: Breakpoint set in overriden file ${defaultPath} will not be hit. Use ${mergesPath} instead.`, true);
                    }
                }
                return mergesPath;
            }
        }
        return defaultPath;
    }
}
exports.CordovaPathTransformer = CordovaPathTransformer;

//# sourceMappingURL=cordovaPathTransformer.js.map
