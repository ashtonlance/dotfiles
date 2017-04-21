// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const cordovaProjectHelper_1 = require("./utils/cordovaProjectHelper");
const cordovaCommandHelper_1 = require("./utils/cordovaCommandHelper");
const extensionServer_1 = require("./extension/extensionServer");
const Q = require("q");
const semver = require("semver");
const simulate_1 = require("./extension/simulate");
const telemetry_1 = require("./utils/telemetry");
const telemetryHelper_1 = require("./utils/telemetryHelper");
const tsdHelper_1 = require("./utils/tsdHelper");
let PLUGIN_TYPE_DEFS_FILENAME = "pluginTypings.json";
let PLUGIN_TYPE_DEFS_PATH = path.resolve(__dirname, "..", "..", PLUGIN_TYPE_DEFS_FILENAME);
let CORDOVA_TYPINGS_QUERYSTRING = "cordova";
let JSCONFIG_FILENAME = "jsconfig.json";
let TSCONFIG_FILENAME = "tsconfig.json";
function activate(context) {
    // Asynchronously enable telemetry
    telemetry_1.Telemetry.init('cordova-tools', require('./../../package.json').version, { isExtensionProcess: true, projectRoot: vscode.workspace.rootPath });
    // Get the project root and check if it is a Cordova project
    if (!vscode.workspace.rootPath) {
        return;
    }
    let cordovaProjectRoot = cordovaProjectHelper_1.CordovaProjectHelper.getCordovaProjectRoot(vscode.workspace.rootPath);
    if (!cordovaProjectRoot) {
        return;
    }
    if (path.resolve(cordovaProjectRoot) !== path.resolve(vscode.workspace.rootPath)) {
        vscode.window.showWarningMessage("VSCode Cordova extension requires the workspace root to be your Cordova project's root. The extension hasn't been activated.");
        return;
    }
    let activateExtensionEvent = telemetryHelper_1.TelemetryHelper.createTelemetryEvent("activate");
    let projectType;
    telemetryHelper_1.TelemetryHelper.determineProjectTypes(cordovaProjectRoot)
        .then((projType) => {
        projectType = projType;
        activateExtensionEvent.properties["projectType"] = projType;
    })
        .finally(() => {
        telemetry_1.Telemetry.send(activateExtensionEvent);
    }).done();
    // We need to update the type definitions added to the project
    // as and when plugins are added or removed. For this reason,
    // setup a file system watcher to watch changes to plugins in the Cordova project
    // Note that watching plugins/fetch.json file would suffice
    let watcher = vscode.workspace.createFileSystemWatcher('**/plugins/fetch.json', false /*ignoreCreateEvents*/, false /*ignoreChangeEvents*/, false /*ignoreDeleteEvents*/);
    watcher.onDidChange((e) => updatePluginTypeDefinitions(cordovaProjectRoot));
    watcher.onDidDelete((e) => updatePluginTypeDefinitions(cordovaProjectRoot));
    watcher.onDidCreate((e) => updatePluginTypeDefinitions(cordovaProjectRoot));
    context.subscriptions.push(watcher);
    let simulator = new simulate_1.PluginSimulator();
    let extensionServer = new extensionServer_1.ExtensionServer(simulator, vscode.workspace.rootPath);
    extensionServer.setup();
    // extensionServer takes care of disposing the simulator instance
    context.subscriptions.push(extensionServer);
    /* Launches a simulate command and records telemetry for it */
    let launchSimulateCommand = function (options) {
        return telemetryHelper_1.TelemetryHelper.generate("simulateCommand", (generator) => {
            return telemetryHelper_1.TelemetryHelper.determineProjectTypes(cordovaProjectRoot)
                .then((projectType) => {
                generator.add("simulateOptions", options, false);
                generator.add("projectType", projectType, false);
                // visibleTextEditors is null proof (returns empty array if no editors visible)
                generator.add("visibleTextEditorsCount", vscode.window.visibleTextEditors.length, false);
            });
        }).then(() => {
            return simulator.simulate(options, projectType);
        });
    };
    // Register Cordova commands
    context.subscriptions.push(vscode.commands.registerCommand('cordova.prepare', () => cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand(cordovaProjectRoot, "prepare")));
    context.subscriptions.push(vscode.commands.registerCommand('cordova.build', () => cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand(cordovaProjectRoot, "build")));
    context.subscriptions.push(vscode.commands.registerCommand('cordova.run', () => cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand(cordovaProjectRoot, "run")));
    context.subscriptions.push(vscode.commands.registerCommand('cordova.simulate.android', () => launchSimulateCommand({ dir: vscode.workspace.rootPath, target: 'chrome', platform: 'android' })));
    context.subscriptions.push(vscode.commands.registerCommand('cordova.simulate.ios', () => launchSimulateCommand({ dir: vscode.workspace.rootPath, target: 'chrome', platform: 'ios' })));
    context.subscriptions.push(vscode.commands.registerCommand('ionic.prepare', () => cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand(cordovaProjectRoot, "prepare", true)));
    context.subscriptions.push(vscode.commands.registerCommand('ionic.build', () => cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand(cordovaProjectRoot, "build", true)));
    context.subscriptions.push(vscode.commands.registerCommand('ionic.run', () => cordovaCommandHelper_1.CordovaCommandHelper.executeCordovaCommand(cordovaProjectRoot, "run", true)));
    // Install Ionic type definitions if necessary
    if (cordovaProjectHelper_1.CordovaProjectHelper.isIonicProject(cordovaProjectRoot)) {
        let ionicTypings = [
            path.join("jquery", "jquery.d.ts"),
            path.join("cordova-ionic", "plugins", "keyboard.d.ts")
        ];
        if (cordovaProjectHelper_1.CordovaProjectHelper.isIonic1Project(cordovaProjectRoot)) {
            ionicTypings = ionicTypings.concat([
                path.join("angularjs", "angular.d.ts"),
                path.join("ionic", "ionic.d.ts")
            ]);
        }
        tsdHelper_1.TsdHelper.installTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(cordovaProjectRoot), ionicTypings, cordovaProjectRoot);
    }
    let pluginTypings = getPluginTypingsJson();
    if (!pluginTypings) {
        return;
    }
    // Install the type defintion files for Cordova
    tsdHelper_1.TsdHelper.installTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(cordovaProjectRoot), [pluginTypings[CORDOVA_TYPINGS_QUERYSTRING].typingFile], cordovaProjectRoot);
    // Install type definition files for the currently installed plugins
    updatePluginTypeDefinitions(cordovaProjectRoot);
    var pluginFilePath = path.join(cordovaProjectRoot, ".vscode", "plugins.json");
    if (fs.existsSync(pluginFilePath)) {
        fs.unlinkSync(pluginFilePath);
    }
    telemetryHelper_1.TelemetryHelper.sendPluginsList(cordovaProjectRoot, cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlugins(cordovaProjectRoot));
    // In VSCode 0.10.10+, if the root doesn't contain jsconfig.json or tsconfig.json, intellisense won't work for files without /// typing references, so add a jsconfig.json here if necessary
    let jsconfigPath = path.join(vscode.workspace.rootPath, JSCONFIG_FILENAME);
    let tsconfigPath = path.join(vscode.workspace.rootPath, TSCONFIG_FILENAME);
    Q.all([Q.nfcall(fs.exists, jsconfigPath), Q.nfcall(fs.exists, tsconfigPath)]).spread((jsExists, tsExists) => {
        if (!jsExists && !tsExists) {
            Q.nfcall(fs.writeFile, jsconfigPath, "{}").then(() => {
                // Any open file must be reloaded to enable intellisense on them, so inform the user
                vscode.window.showInformationMessage("A 'jsconfig.json' file was created to enable IntelliSense. You may need to reload your open JS file(s).");
            });
        }
    });
}
exports.activate = activate;
function deactivate(context) {
    console.log("Extension has been deactivated");
}
exports.deactivate = deactivate;
function getPluginTypingsJson() {
    if (cordovaProjectHelper_1.CordovaProjectHelper.existsSync(PLUGIN_TYPE_DEFS_PATH)) {
        return require(PLUGIN_TYPE_DEFS_PATH);
    }
    console.error("Cordova plugin type declaration mapping file \"pluginTypings.json\" is missing from the extension folder.");
    return null;
}
function getNewTypeDefinitions(installedPlugins) {
    let newTypeDefs = [];
    let pluginTypings = getPluginTypingsJson();
    if (!pluginTypings) {
        return;
    }
    return installedPlugins.filter(pluginName => !!pluginTypings[pluginName])
        .map(pluginName => pluginTypings[pluginName].typingFile);
}
function addPluginTypeDefinitions(projectRoot, installedPlugins, currentTypeDefs) {
    let pluginTypings = getPluginTypingsJson();
    if (!pluginTypings) {
        return;
    }
    let typingsToAdd = installedPlugins.filter((pluginName) => {
        if (pluginTypings[pluginName]) {
            return currentTypeDefs.indexOf(pluginTypings[pluginName].typingFile) < 0;
        }
        // If we do not know the plugin, collect it anonymously for future prioritisation
        let unknownPluginEvent = telemetryHelper_1.TelemetryHelper.createTelemetryEvent('unknownPlugin');
        unknownPluginEvent.setPiiProperty('plugin', pluginName);
        telemetry_1.Telemetry.send(unknownPluginEvent);
        return false;
    }).map((pluginName) => {
        return pluginTypings[pluginName].typingFile;
    });
    tsdHelper_1.TsdHelper.installTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(projectRoot), typingsToAdd, cordovaProjectHelper_1.CordovaProjectHelper.getCordovaProjectRoot(vscode.workspace.rootPath));
}
function removePluginTypeDefinitions(projectRoot, currentTypeDefs, newTypeDefs) {
    // Find the type definition files that need to be removed
    let typeDefsToRemove = currentTypeDefs
        .filter((typeDef) => newTypeDefs.indexOf(typeDef) < 0);
    tsdHelper_1.TsdHelper.removeTypings(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(projectRoot), typeDefsToRemove, projectRoot);
}
function getRelativeTypeDefinitionFilePath(projectRoot, parentPath, typeDefinitionFile) {
    return path.relative(cordovaProjectHelper_1.CordovaProjectHelper.getOrCreateTypingsTargetPath(projectRoot), path.resolve(parentPath, typeDefinitionFile)).replace(/\\/g, "\/");
}
function updatePluginTypeDefinitions(cordovaProjectRoot) {
    // We don't need to install typings for Ionic2 since it has own TS
    // wrapper around core plugins. We also won't try to manage typings
    // in typescript projects as it might break compilation due to conflicts
    // between typings we install and user-installed ones.
    if (cordovaProjectHelper_1.CordovaProjectHelper.isIonic2Project(cordovaProjectRoot) ||
        cordovaProjectHelper_1.CordovaProjectHelper.isTypescriptProject(cordovaProjectRoot)) {
        return;
    }
    let installedPlugins = cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlugins(cordovaProjectRoot);
    const nodeModulesDir = path.resolve(cordovaProjectRoot, 'node_modules');
    if (semver.gte(vscode.version, '1.7.2-insider') && fs.existsSync(nodeModulesDir)) {
        // Read installed node modules and filter out plugins that have been already installed in node_modules
        // This happens if user has used '--fetch' option to install plugin. In this case VSCode will provide
        // own intellisense for these plugins using ATA (automatic typings acquisition)
        let installedNpmModules = [];
        try {
            installedNpmModules = fs.readdirSync(nodeModulesDir);
        }
        catch (e) { }
        const pluginTypingsJson = getPluginTypingsJson() || {};
        installedPlugins = installedPlugins.filter(pluginId => {
            // plugins with `forceInstallTypings` flag don't have typings on NPM yet,
            // so we still need to install these even if they present in 'node_modules'
            const forceInstallTypings = pluginTypingsJson[pluginId] &&
                pluginTypingsJson[pluginId].forceInstallTypings;
            return forceInstallTypings || installedNpmModules.indexOf(pluginId) === -1;
        });
    }
    let newTypeDefs = getNewTypeDefinitions(installedPlugins);
    let cordovaPluginTypesFolder = cordovaProjectHelper_1.CordovaProjectHelper.getCordovaPluginTypeDefsPath(cordovaProjectRoot);
    let ionicPluginTypesFolder = cordovaProjectHelper_1.CordovaProjectHelper.getIonicPluginTypeDefsPath(cordovaProjectRoot);
    if (!cordovaProjectHelper_1.CordovaProjectHelper.existsSync(cordovaPluginTypesFolder)) {
        addPluginTypeDefinitions(cordovaProjectRoot, installedPlugins, []);
        return;
    }
    let currentTypeDefs = [];
    // Now read the type definitions of Cordova plugins
    fs.readdir(cordovaPluginTypesFolder, (err, cordovaTypeDefs) => {
        if (cordovaTypeDefs) {
            currentTypeDefs = cordovaTypeDefs.map(typeDef => getRelativeTypeDefinitionFilePath(cordovaProjectRoot, cordovaPluginTypesFolder, typeDef));
        }
        // Now read the type definitions of Ionic plugins
        fs.readdir(ionicPluginTypesFolder, (err, ionicTypeDefs) => {
            if (ionicTypeDefs) {
                currentTypeDefs.concat(ionicTypeDefs.map(typeDef => getRelativeTypeDefinitionFilePath(cordovaProjectRoot, ionicPluginTypesFolder, typeDef)));
            }
            addPluginTypeDefinitions(cordovaProjectRoot, installedPlugins, currentTypeDefs);
            removePluginTypeDefinitions(cordovaProjectRoot, currentTypeDefs, newTypeDefs);
        });
    });
}

//# sourceMappingURL=cordova.js.map
