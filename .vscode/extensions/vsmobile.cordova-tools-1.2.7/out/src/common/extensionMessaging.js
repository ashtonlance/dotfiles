// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const hash_1 = require("../utils/hash");
const Q = require("q");
const net = require("net");
exports.ErrorMarker = "vscode-cordova-error-marker";
/**
 * Defines the messages sent to the extension.
 * Add new messages to this enum.
 */
var ExtensionMessage;
(function (ExtensionMessage) {
    ExtensionMessage[ExtensionMessage["GET_VISIBLE_EDITORS_COUNT"] = 0] = "GET_VISIBLE_EDITORS_COUNT";
    ExtensionMessage[ExtensionMessage["LAUNCH_SIM_HOST"] = 1] = "LAUNCH_SIM_HOST";
    ExtensionMessage[ExtensionMessage["SEND_TELEMETRY"] = 2] = "SEND_TELEMETRY";
    ExtensionMessage[ExtensionMessage["SIMULATE"] = 3] = "SIMULATE";
    ExtensionMessage[ExtensionMessage["START_SIMULATE_SERVER"] = 4] = "START_SIMULATE_SERVER";
})(ExtensionMessage = exports.ExtensionMessage || (exports.ExtensionMessage = {}));
/**
 * Sends messages to the extension.
 */
class ExtensionMessageSender {
    constructor(projectRoot) {
        this.hash = hash_1.Hash.hashCode(projectRoot);
    }
    getExtensionPipePath() {
        switch (process.platform) {
            case "win32":
                return `\\\\?\\pipe\\vscodecordova-${this.hash}`;
            default:
                return `/tmp/vscodecordova-${this.hash}.sock`;
        }
    }
    sendMessage(message, args) {
        let deferred = Q.defer();
        let messageWithArguments = { message: message, args: args };
        let body = "";
        let pipePath = this.getExtensionPipePath();
        let socket = net.connect(pipePath, function () {
            let messageJson = JSON.stringify(messageWithArguments);
            socket.write(messageJson);
        });
        socket.on("data", function (data) {
            body += data;
        });
        socket.on("error", function (data) {
            deferred.reject(new Error("An error occurred while handling message: " + ExtensionMessage[message]));
        });
        socket.on("end", function () {
            try {
                if (body.startsWith(exports.ErrorMarker)) {
                    let errorString = body.replace(exports.ErrorMarker, "");
                    let error = new Error(errorString ? errorString : "An error occurred while handling message: " + ExtensionMessage[message]);
                    deferred.reject(error);
                }
                else {
                    let responseBody = body ? JSON.parse(body) : null;
                    deferred.resolve(responseBody);
                }
            }
            catch (e) {
                deferred.reject(e);
            }
        });
        return deferred.promise;
    }
}
exports.ExtensionMessageSender = ExtensionMessageSender;

//# sourceMappingURL=extensionMessaging.js.map
