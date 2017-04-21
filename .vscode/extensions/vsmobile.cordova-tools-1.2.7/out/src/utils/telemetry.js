// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
/// <reference path='../../typings/winreg/winreg.d.ts' />
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Q = require("q");
const winreg = require("winreg");
const extensionMessaging_1 = require("../common/extensionMessaging");
const settingsHelper_1 = require("./settingsHelper");
/**
 * Telemetry module specialized for vscode integration.
 */
var Telemetry;
(function (Telemetry) {
    Telemetry.isOptedIn = false;
    Telemetry.reporterDictionary = {};
    ;
    /**
     * TelemetryEvent represents a basic telemetry data point
     */
    class TelemetryEvent {
        constructor(name, properties) {
            this.name = name;
            this.properties = properties || {};
            this.eventId = TelemetryUtils.generateGuid();
        }
        setPiiProperty(name, value) {
            var hmac = crypto.createHmac('sha256', new Buffer(TelemetryEvent.PII_HASH_KEY, 'utf8'));
            var hashedValue = hmac.update(value).digest('hex');
            this.properties[name] = hashedValue;
            if (Telemetry.isInternal()) {
                this.properties[name + '.nothashed'] = value;
            }
        }
    }
    TelemetryEvent.PII_HASH_KEY = '959069c9-9e93-4fa1-bf16-3f8120d7db0c';
    Telemetry.TelemetryEvent = TelemetryEvent;
    ;
    /**
     * TelemetryActivity automatically includes timing data, used for scenarios where we want to track performance.
     * Calls to start() and end() are optional, if not called explicitly then the constructor will be the start and send will be the end.
     * This event will include a property called reserved.activity.duration which represents time in milliseconds.
     */
    class TelemetryActivity extends TelemetryEvent {
        constructor(name, properties) {
            super(name, properties);
            this.start();
        }
        start() {
            this.startTime = process.hrtime();
        }
        end() {
            if (!this.endTime) {
                this.endTime = process.hrtime(this.startTime);
                // convert [seconds, nanoseconds] to milliseconds and include as property
                this.properties['reserved.activity.duration'] = this.endTime[0] * 1000 + this.endTime[1] / 1000000;
            }
        }
    }
    Telemetry.TelemetryActivity = TelemetryActivity;
    ;
    function init(appNameValue, appVersion, initOptions) {
        try {
            Telemetry.appName = appNameValue;
            return TelemetryUtils.init(appVersion, initOptions);
        }
        catch (err) {
            console.error(err);
        }
    }
    Telemetry.init = init;
    function send(event, ignoreOptIn = false) {
        return TelemetryUtils.initDeferred.promise.then(function () {
            if (Telemetry.isOptedIn || ignoreOptIn) {
                TelemetryUtils.addCommonProperties(event);
                try {
                    if (event instanceof TelemetryActivity) {
                        event.end();
                    }
                    if (Telemetry.reporter) {
                        var properties = {};
                        var measures = {};
                        Object.keys(event.properties || {}).forEach(function (key) {
                            var propertyValue = event.properties[key];
                            switch (typeof propertyValue) {
                                case "string":
                                    properties[key] = propertyValue;
                                    break;
                                case "number":
                                    measures[key] = propertyValue;
                                    break;
                                default:
                                    properties[key] = JSON.stringify(propertyValue);
                                    break;
                            }
                        });
                        Telemetry.reporter.sendTelemetryEvent(event.name, properties, measures);
                    }
                }
                catch (err) {
                    console.error(err);
                }
            }
        });
    }
    Telemetry.send = send;
    function isInternal() {
        return TelemetryUtils.userType === TelemetryUtils.USERTYPE_INTERNAL;
    }
    Telemetry.isInternal = isInternal;
    function getSessionId() {
        return TelemetryUtils.sessionId;
    }
    Telemetry.getSessionId = getSessionId;
    function setSessionId(sessionId) {
        TelemetryUtils.sessionId = sessionId;
    }
    Telemetry.setSessionId = setSessionId;
    class TelemetryUtils {
        static get telemetrySettingsFile() {
            return path.join(settingsHelper_1.settingsHome(), TelemetryUtils.TELEMETRY_SETTINGS_FILENAME);
        }
        static init(appVersion, initOptions) {
            TelemetryUtils.loadSettings();
            if (initOptions.isExtensionProcess) {
                let TelemetryReporter = require('vscode-extension-telemetry').default;
                Telemetry.reporter = new TelemetryReporter(Telemetry.appName, appVersion, TelemetryUtils.APPINSIGHTS_INSTRUMENTATIONKEY);
            }
            else {
                Telemetry.reporter = new ExtensionTelemetryReporter(Telemetry.appName, appVersion, TelemetryUtils.APPINSIGHTS_INSTRUMENTATIONKEY, initOptions.projectRoot);
            }
            TelemetryUtils.getUserId()
                .then(function (userId) {
                TelemetryUtils.userId = userId;
                TelemetryUtils.userType = TelemetryUtils.getUserType();
                Telemetry.isOptedIn = TelemetryUtils.getTelemetryOptInSetting();
                TelemetryUtils.saveSettings();
                TelemetryUtils.initDeferred.resolve(void 0);
            });
            return TelemetryUtils.initDeferred.promise;
        }
        static addCommonProperties(event) {
            if (Telemetry.isOptedIn) {
                event.properties['cordova.userId'] = TelemetryUtils.userId;
            }
            event.properties['cordova.userType'] = TelemetryUtils.userType;
        }
        static generateGuid() {
            var hexValues = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
            // c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
            var oct = '';
            var tmp;
            /* tslint:disable:no-bitwise */
            for (var a = 0; a < 4; a++) {
                tmp = (4294967296 * Math.random()) | 0;
                oct += hexValues[tmp & 0xF] + hexValues[tmp >> 4 & 0xF] + hexValues[tmp >> 8 & 0xF] + hexValues[tmp >> 12 & 0xF] + hexValues[tmp >> 16 & 0xF] + hexValues[tmp >> 20 & 0xF] + hexValues[tmp >> 24 & 0xF] + hexValues[tmp >> 28 & 0xF];
            }
            // 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
            var clockSequenceHi = hexValues[8 + (Math.random() * 4) | 0];
            return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
            /* tslint:enable:no-bitwise */
        }
        static getTelemetryOptInSetting() {
            if (TelemetryUtils.telemetrySettings.optIn === undefined) {
                // Opt-in by default
                TelemetryUtils.telemetrySettings.optIn = true;
            }
            return TelemetryUtils.telemetrySettings.optIn;
        }
        static getUserType() {
            var userType = TelemetryUtils.telemetrySettings.userType;
            if (userType === undefined) {
                if (process.env[TelemetryUtils.INTERNAL_USER_ENV_VAR]) {
                    userType = TelemetryUtils.USERTYPE_INTERNAL;
                }
                else if (os.platform() === 'win32') {
                    var domain = process.env['USERDNSDOMAIN'];
                    domain = domain ? domain.toLowerCase().substring(domain.length - TelemetryUtils.INTERNAL_DOMAIN_SUFFIX.length) : null;
                    userType = domain === TelemetryUtils.INTERNAL_DOMAIN_SUFFIX ? TelemetryUtils.USERTYPE_INTERNAL : TelemetryUtils.USERTYPE_EXTERNAL;
                }
                else {
                    userType = TelemetryUtils.USERTYPE_EXTERNAL;
                }
                TelemetryUtils.telemetrySettings.userType = userType;
            }
            return userType;
        }
        static getRegistryValue(key, value, hive) {
            var deferred = Q.defer();
            var regKey = new winreg({
                hive: hive,
                key: key
            });
            regKey.get(value, function (err, itemValue) {
                if (err) {
                    // Fail gracefully by returning null if there was an error.
                    deferred.resolve(null);
                }
                else {
                    deferred.resolve(itemValue.value);
                }
            });
            return deferred.promise;
        }
        /*
         * Load settings data from settingsHome/TelemetrySettings.json
         */
        static loadSettings() {
            try {
                TelemetryUtils.telemetrySettings = JSON.parse(fs.readFileSync(TelemetryUtils.telemetrySettingsFile));
            }
            catch (e) {
                // if file does not exist or fails to parse then assume no settings are saved and start over
                TelemetryUtils.telemetrySettings = {};
            }
            return TelemetryUtils.telemetrySettings;
        }
        /*
         * Save settings data in settingsHome/TelemetrySettings.json
         */
        static saveSettings() {
            if (!fs.existsSync(settingsHelper_1.settingsHome())) {
                fs.mkdirSync(settingsHelper_1.settingsHome());
            }
            fs.writeFileSync(TelemetryUtils.telemetrySettingsFile, JSON.stringify(TelemetryUtils.telemetrySettings));
        }
        static getUniqueId(regValue, regHive, fallback) {
            var uniqueId;
            var deferred = Q.defer();
            if (os.platform() === 'win32') {
                return TelemetryUtils.getRegistryValue(TelemetryUtils.REGISTRY_SQMCLIENT_NODE, regValue, regHive)
                    .then(function (id) {
                    if (id) {
                        uniqueId = id.replace(/[{}]/g, '');
                        return Q.resolve(uniqueId);
                    }
                    else {
                        return Q.resolve(fallback());
                    }
                });
            }
            else {
                return Q.resolve(fallback());
            }
        }
        static getUserId() {
            var userId = TelemetryUtils.telemetrySettings.userId;
            if (!userId) {
                return TelemetryUtils.getUniqueId(TelemetryUtils.REGISTRY_USERID_VALUE, winreg.HKCU, TelemetryUtils.generateGuid)
                    .then(function (id) {
                    TelemetryUtils.telemetrySettings.userId = id;
                    return Q.resolve(id);
                });
            }
            else {
                TelemetryUtils.telemetrySettings.userId = userId;
                return Q.resolve(userId);
            }
        }
    }
    TelemetryUtils.USERTYPE_INTERNAL = 'Internal';
    TelemetryUtils.USERTYPE_EXTERNAL = 'External';
    TelemetryUtils.initDeferred = Q.defer();
    TelemetryUtils.telemetrySettings = null;
    TelemetryUtils.TELEMETRY_SETTINGS_FILENAME = 'VSCodeTelemetrySettings.json';
    TelemetryUtils.APPINSIGHTS_INSTRUMENTATIONKEY = 'AIF-d9b70cd4-b9f9-4d70-929b-a071c400b217'; // Matches vscode telemetry key
    TelemetryUtils.REGISTRY_SQMCLIENT_NODE = '\\SOFTWARE\\Microsoft\\SQMClient';
    TelemetryUtils.REGISTRY_USERID_VALUE = 'UserId';
    TelemetryUtils.INTERNAL_DOMAIN_SUFFIX = 'microsoft.com';
    TelemetryUtils.INTERNAL_USER_ENV_VAR = 'TACOINTERNAL';
    ;
    class ExtensionTelemetryReporter {
        constructor(extensionId, extensionVersion, key, projectRoot) {
            this.extensionId = extensionId;
            this.extensionVersion = extensionVersion;
            this.appInsightsKey = key;
            this.extensionMessageSender = new extensionMessaging_1.ExtensionMessageSender(projectRoot);
        }
        sendTelemetryEvent(eventName, properties, measures) {
            this.extensionMessageSender.sendMessage(extensionMessaging_1.ExtensionMessage.SEND_TELEMETRY, [this.extensionId, this.extensionVersion, this.appInsightsKey, eventName, properties, measures])
                .catch(function () { })
                .done();
        }
    }
    function sendExtensionTelemetry(extensionId, extensionVersion, appInsightsKey, eventName, properties, measures) {
        let reporter = Telemetry.reporterDictionary[extensionId];
        if (!reporter) {
            let TelemetryReporter = require('vscode-extension-telemetry').default;
            Telemetry.reporterDictionary[extensionId] = new TelemetryReporter(extensionId, extensionVersion, appInsightsKey);
            reporter = Telemetry.reporterDictionary[extensionId];
        }
        reporter.sendTelemetryEvent(eventName, properties, measures);
    }
    Telemetry.sendExtensionTelemetry = sendExtensionTelemetry;
})(Telemetry = exports.Telemetry || (exports.Telemetry = {}));
;

//# sourceMappingURL=telemetry.js.map
