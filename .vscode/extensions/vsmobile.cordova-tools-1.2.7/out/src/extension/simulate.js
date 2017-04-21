// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const hash_1 = require("../utils/hash");
const Q = require("q");
const path = require("path");
const cordova_simulate_1 = require("cordova-simulate");
const cordovaSimulateTelemetry_1 = require("../utils/cordovaSimulateTelemetry");
const vscode = require("vscode");
/**
 * Plugin simulation entry point.
 */
class PluginSimulator {
    constructor() {
        this.simulateProtocol = "cordova-simulate-" + hash_1.Hash.hashCode(vscode.workspace.rootPath);
        this.simulateUri = vscode.Uri.parse(this.simulateProtocol + "://authority/cordova-simulate");
        this.defaultSimulateTempDir = path.join(vscode.workspace.rootPath, ".vscode", "simulate");
    }
    simulate(simulateOptions, projectType) {
        return this.launchServer(simulateOptions, projectType)
            .then(() => this.launchAppHost(simulateOptions.target))
            .then(() => this.launchSimHost());
    }
    launchAppHost(target) {
        return cordova_simulate_1.launchBrowser(target, this.simulationInfo.appHostUrl);
    }
    launchSimHost() {
        if (!this.simulator) {
            return Q.reject(new Error("Launching sim host before starting simulation server"));
        }
        let provider = new SimHostContentProvider(this.simulator.simHostUrl());
        this.registration = vscode.workspace.registerTextDocumentContentProvider(this.simulateProtocol, provider);
        return Q(vscode.commands.executeCommand("vscode.previewHtml", this.simulateUri, vscode.ViewColumn.Two).then(() => void 0));
    }
    launchServer(simulateOptions, projectType) {
        simulateOptions.dir = vscode.workspace.rootPath;
        if (!simulateOptions.simulationpath) {
            simulateOptions.simulationpath = this.defaultSimulateTempDir;
        }
        return Q({}).then(() => {
            if (this.isServerRunning()) {
                /* close the server old instance */
                return this.simulator.stopSimulation();
            }
        })
            .then(() => {
            let simulateTelemetryWrapper = new cordovaSimulateTelemetry_1.CordovaSimulateTelemetry();
            simulateOptions.telemetry = simulateTelemetryWrapper;
            this.simulator = new cordova_simulate_1.Simulator(simulateOptions);
            return this.simulator.startSimulation()
                .then(() => {
                this.simulationInfo = {
                    appHostUrl: this.simulator.appUrl(),
                    simHostUrl: this.simulator.simHostUrl(),
                    urlRoot: this.simulator.urlRoot(),
                };
                if (projectType.ionic2 && simulateOptions.platform && simulateOptions.platform !== "browser") {
                    this.simulationInfo.appHostUrl = `${this.simulationInfo.appHostUrl}?ionicplatform=${simulateOptions.platform}`;
                }
                return this.simulationInfo;
            });
        });
    }
    isServerRunning() {
        return this.simulator && this.simulator.isRunning();
    }
    dispose() {
        if (this.registration) {
            this.registration.dispose();
            this.registration = null;
        }
        if (this.simulator) {
            this.simulator.stopSimulation().done(() => { }, () => { });
            this.simulator = null;
        }
    }
}
exports.PluginSimulator = PluginSimulator;
/**
 * Content provider hosting the simulation UI inside a document.
 */
class SimHostContentProvider {
    constructor(simHostUrl) {
        this.simHostUrl = simHostUrl;
    }
    provideTextDocumentContent(uri) {
        return `<!DOCTYPE html>
                <html>
                <head>
                    <style>
                        html, body {
                            height: 100%;
                            margin: 0;
                            overflow: hidden;
                        }

                        .intrinsic-container iframe {
                            position: absolute;
                            top:0;
                            left: 0;
                            border: 0;
                            width: 100%;
                            height: 100%;
                        }
                    </style>
                </head>
                <body>
                    <div class="intrinsic-container">
                        <iframe src="${this.simHostUrl}" ></iframe>
                    </div>
                </body>
                </html>`;
    }
}

//# sourceMappingURL=simulate.js.map
