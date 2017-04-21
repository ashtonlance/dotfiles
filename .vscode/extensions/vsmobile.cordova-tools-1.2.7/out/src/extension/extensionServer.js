// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const net = require("net");
const Q = require("q");
const vscode = require("vscode");
const extensionMessaging_1 = require("../common/extensionMessaging");
const cordovaProjectHelper_1 = require("../utils/cordovaProjectHelper");
const telemetry_1 = require("../utils/telemetry");
class ExtensionServer {
    constructor(pluginSimulator, projectRoot) {
        this.serverInstance = null;
        this.messageHandlerDictionary = {};
        let messageSender = new extensionMessaging_1.ExtensionMessageSender(projectRoot);
        this.pipePath = messageSender.getExtensionPipePath();
        this.pluginSimulator = pluginSimulator;
        // Register handlers for all messages
        this.messageHandlerDictionary[extensionMessaging_1.ExtensionMessage.SEND_TELEMETRY] = this.sendTelemetry;
        this.messageHandlerDictionary[extensionMessaging_1.ExtensionMessage.LAUNCH_SIM_HOST] = this.launchSimHost;
        this.messageHandlerDictionary[extensionMessaging_1.ExtensionMessage.SIMULATE] = this.simulate;
        this.messageHandlerDictionary[extensionMessaging_1.ExtensionMessage.START_SIMULATE_SERVER] = this.launchSimulateServer;
        this.messageHandlerDictionary[extensionMessaging_1.ExtensionMessage.GET_VISIBLE_EDITORS_COUNT] = this.getVisibleEditorsCount;
    }
    /**
     * Starts the server.
     */
    setup() {
        let deferred = Q.defer();
        let launchCallback = (error) => {
            if (error) {
                deferred.reject(error);
            }
            else {
                deferred.resolve(null);
            }
        };
        this.serverInstance = net.createServer(this.handleSocket.bind(this));
        this.serverInstance.on("error", this.recoverServer.bind(this));
        this.serverInstance.listen(this.pipePath, launchCallback);
        return deferred.promise;
    }
    /**
     * Stops the server.
     */
    dispose() {
        if (this.serverInstance) {
            this.serverInstance.close();
            this.serverInstance = null;
        }
        if (this.pluginSimulator) {
            this.pluginSimulator.dispose();
            this.pluginSimulator = null;
        }
    }
    /**
     * Sends telemetry
     */
    sendTelemetry(extensionId, extensionVersion, appInsightsKey, eventName, properties, measures) {
        telemetry_1.Telemetry.sendExtensionTelemetry(extensionId, extensionVersion, appInsightsKey, eventName, properties, measures);
        return Q.resolve({});
    }
    /**
     * Prepares for simulate debugging. The server and simulate host are launched here.
     * The application host is launched by the debugger.
     *
     * Returns info about the running simulate server
     */
    simulate(simulateOptions, projectType) {
        return this.launchSimulateServer(simulateOptions, projectType)
            .then((simulateInfo) => {
            return this.launchSimHost().then(() => simulateInfo);
        });
    }
    /**
     * Launches the simulate server. Only the server is launched here.
     *
     * Returns info about the running simulate server
     */
    launchSimulateServer(simulateOptions, projectType) {
        return this.pluginSimulator.launchServer(simulateOptions, projectType);
    }
    /**
     * Launches sim-host using an already running simulate server.
     */
    launchSimHost() {
        return this.pluginSimulator.launchSimHost();
    }
    /**
     * Returns the number of currently visible editors.
     */
    getVisibleEditorsCount() {
        // visibleTextEditors is null proof (returns empty array if no editors visible)
        return Q.resolve(vscode.window.visibleTextEditors.length);
    }
    /**
     * Extension message handler.
     */
    handleExtensionMessage(messageWithArgs) {
        let handler = this.messageHandlerDictionary[messageWithArgs.message];
        if (handler) {
            return handler.apply(this, messageWithArgs.args);
        }
        else {
            return Q.reject("Invalid message: " + messageWithArgs.message);
        }
    }
    /**
     * Handles connections to the server.
     */
    handleSocket(socket) {
        let handleError = (e) => {
            let errorMessage = e ? e.message || e.error || e.data || e : "";
            socket.end(extensionMessaging_1.ErrorMarker + errorMessage);
        };
        let dataCallback = (data) => {
            try {
                let messageWithArgs = JSON.parse(data);
                this.handleExtensionMessage(messageWithArgs)
                    .then(result => {
                    socket.end(JSON.stringify(result));
                })
                    .catch((e) => { handleError(e); })
                    .done();
            }
            catch (e) {
                handleError(e);
            }
        };
        socket.on("data", dataCallback);
    }
    ;
    /**
     * Recovers the server in case the named socket we use already exists, but no other instance of VSCode is active.
     */
    recoverServer(error) {
        let errorHandler = (e) => {
            /* The named socket is not used. */
            if (e.code === "ECONNREFUSED") {
                cordovaProjectHelper_1.CordovaProjectHelper.deleteDirectoryRecursive(this.pipePath);
                this.serverInstance.listen(this.pipePath);
            }
        };
        /* The named socket already exists. */
        if (error.code === "EADDRINUSE") {
            let clientSocket = new net.Socket();
            clientSocket.on("error", errorHandler);
            clientSocket.connect(this.pipePath, function () {
                clientSocket.end();
            });
        }
    }
}
exports.ExtensionServer = ExtensionServer;

//# sourceMappingURL=extensionServer.js.map
