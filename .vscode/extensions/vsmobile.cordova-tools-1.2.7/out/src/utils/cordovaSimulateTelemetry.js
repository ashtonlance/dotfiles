// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const telemetry_1 = require("./telemetry");
const telemetryHelper_1 = require("./telemetryHelper");
/**
 * This class is a telemetry wrapper compatible with cordova-simulate's telemetry. Cordova-simulate expects an object with a sendTelemetry() function, and calls it every time there is a
 * telemetry event. This wrapper creates a telemetry event compatible with vscode-cordova's telemetry, based on cordova-simulate's event, and sends it using the Telemetry module.
 */
class CordovaSimulateTelemetry {
    sendTelemetry(eventName, props, piiProps) {
        let fullEventName = 'cordova-simulate-' + eventName;
        let generator = new telemetryHelper_1.TelemetryGenerator(fullEventName);
        let telemetryEvent = new telemetry_1.Telemetry.TelemetryEvent(fullEventName);
        Object.keys(props).forEach((prop) => {
            generator.add(prop, props[prop], false);
        });
        Object.keys(piiProps).forEach((prop) => {
            generator.add(prop, piiProps[prop], true);
        });
        telemetryHelper_1.TelemetryHelper.addTelemetryEventProperties(telemetryEvent, generator.getTelemetryProperties());
        telemetry_1.Telemetry.send(telemetryEvent);
    }
}
exports.CordovaSimulateTelemetry = CordovaSimulateTelemetry;

//# sourceMappingURL=cordovaSimulateTelemetry.js.map
