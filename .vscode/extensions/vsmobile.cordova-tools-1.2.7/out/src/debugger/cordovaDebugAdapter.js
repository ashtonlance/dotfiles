// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const child_process = require("child_process");
const elementtree = require("elementtree");
const fs = require("fs");
const http = require("http");
const io = require("socket.io-client");
const messaging = require("../common/extensionMessaging");
const os = require("os");
const path = require("path");
const Q = require("q");
const vscode_debugadapter_1 = require("vscode-debugadapter");
const vscode_chrome_debug_core_1 = require("vscode-chrome-debug-core");
const cordovaIosDeviceLauncher_1 = require("./cordovaIosDeviceLauncher");
const extension_1 = require("./extension");
const cordovaProjectHelper_1 = require("../utils/cordovaProjectHelper");
const telemetryHelper_1 = require("../utils/telemetryHelper");
const settingsHelper_1 = require("../utils/settingsHelper");
const telemetry_1 = require("../utils/telemetry");
const WIN_APPDATA = process.env.LOCALAPPDATA || '/';
const DEFAULT_CHROME_PATH = {
    LINUX: '/usr/bin/google-chrome',
    OSX: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    WIN: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    WIN_LOCALAPPDATA: path.join(WIN_APPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    WINx86: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
};
class CordovaDebugAdapter extends vscode_chrome_debug_core_1.ChromeDebugAdapter {
    constructor(opts, debugSession) {
        super(opts, debugSession);
        // Bit of a hack, but chrome-debug-adapter-core no longer provides a way to access the transformer.
        this.cordovaPathTransformer = global.cordovaPathTransformer;
        this.telemetryInitialized = false;
        this.outputLogger = (message, error) => {
            var category = "console";
            if (error === true) {
                category = "stderr";
            }
            if (typeof error === 'string') {
                category = error;
            }
            debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(message + '\n', category));
        };
        this.attachedDeferred = Q.defer();
    }
    launch(launchArgs) {
        this.previousLaunchArgs = launchArgs;
        return new Promise((resolve, reject) => this.initializeTelemetry(launchArgs.cwd)
            .then(() => telemetryHelper_1.TelemetryHelper.generate('launch', (generator) => {
            launchArgs.port = launchArgs.port || 9222;
            launchArgs.target = launchArgs.target || (launchArgs.platform === 'browser' ? 'chrome' : 'emulator');
            launchArgs.cwd = cordovaProjectHelper_1.CordovaProjectHelper.getCordovaProjectRoot(launchArgs.cwd);
            let platform = launchArgs.platform && launchArgs.platform.toLowerCase();
            telemetryHelper_1.TelemetryHelper.sendPluginsList(launchArgs.cwd, cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlugins(launchArgs.cwd));
            return telemetryHelper_1.TelemetryHelper.determineProjectTypes(launchArgs.cwd)
                .then((projectType) => {
                generator.add('projectType', projectType, false);
                this.outputLogger(`Launching for ${platform} (This may take a while)...`);
                switch (platform) {
                    case 'android':
                        /* tslint:disable:no-switch-case-fall-through */
                        generator.add('platform', platform, false);
                        if (this.isSimulateTarget(launchArgs.target)) {
                            return this.launchSimulate(launchArgs, projectType, generator);
                        }
                        else {
                            return this.launchAndroid(launchArgs, projectType);
                        }
                    /* tslint:enable:no-switch-case-fall-through */
                    case 'ios':
                        /* tslint:disable:no-switch-case-fall-through */
                        generator.add('platform', platform, false);
                        if (this.isSimulateTarget(launchArgs.target)) {
                            return this.launchSimulate(launchArgs, projectType, generator);
                        }
                        else {
                            return this.launchIos(launchArgs, projectType);
                        }
                    /* tslint:enable:no-switch-case-fall-through */
                    case 'serve':
                        generator.add('platform', platform, false);
                        return this.launchServe(launchArgs, projectType);
                    case 'browser':
                        generator.add('platform', platform, false);
                        return this.launchSimulate(launchArgs, projectType, generator);
                    default:
                        generator.add('unknownPlatform', platform, true);
                        throw new Error(`Unknown Platform: ${platform}`);
                }
            }).catch((err) => {
                this.outputLogger(err.message || err, true);
                return this.cleanUp().then(() => {
                    throw err;
                });
            }).then(() => {
                // For the browser platforms, we call super.launch(), which already attaches. For other platforms, attach here
                if (platform !== 'serve' && platform !== 'browser' && !this.isSimulateTarget(launchArgs.target)) {
                    return this.attach(launchArgs);
                }
            });
        }).done(resolve, reject)));
    }
    isSimulateTarget(target) {
        return CordovaDebugAdapter.SIMULATE_TARGETS.indexOf(target) > -1;
    }
    attach(attachArgs) {
        this.previousAttachArgs = attachArgs;
        return new Promise((resolve, reject) => this.initializeTelemetry(attachArgs.cwd)
            .then(() => telemetryHelper_1.TelemetryHelper.generate('attach', (generator) => {
            attachArgs.port = attachArgs.port || 9222;
            attachArgs.target = attachArgs.target || 'emulator';
            attachArgs.cwd = cordovaProjectHelper_1.CordovaProjectHelper.getCordovaProjectRoot(attachArgs.cwd);
            let platform = attachArgs.platform && attachArgs.platform.toLowerCase();
            telemetryHelper_1.TelemetryHelper.sendPluginsList(attachArgs.cwd, cordovaProjectHelper_1.CordovaProjectHelper.getInstalledPlugins(attachArgs.cwd));
            return telemetryHelper_1.TelemetryHelper.determineProjectTypes(attachArgs.cwd)
                .then((projectType) => generator.add('projectType', projectType, false))
                .then(() => {
                this.outputLogger(`Attaching to ${platform}`);
                switch (platform) {
                    case 'android':
                        generator.add('platform', platform, false);
                        return this.attachAndroid(attachArgs);
                    case 'ios':
                        generator.add('platform', platform, false);
                        return this.attachIos(attachArgs);
                    default:
                        generator.add('unknownPlatform', platform, true);
                        throw new Error(`Unknown Platform: ${platform}`);
                }
            }).then((processedAttachArgs) => {
                this.outputLogger('Attaching to app.');
                this.outputLogger('', true); // Send blank message on stderr to include a divider between prelude and app starting
                return super.attach(processedAttachArgs).then(() => {
                    this.attachedDeferred.resolve(void 0);
                });
            });
        }).catch((err) => {
            this.outputLogger(err.message || err, true);
            return this.cleanUp().then(() => {
                throw err;
            });
        }).done(resolve, reject)));
    }
    disconnect() {
        this.cleanUp();
        return super.disconnect();
    }
    commonArgs(args) {
        // If we specify skipFileRegExps or skipFiles then vscode-chrome-debug-core attempts to call Debugger.setBlackboxPatterns
        // however in older targets that API is not implemented, and results in errors.
        args.skipFileRegExps = args.skipFiles = null;
        super.commonArgs(args);
    }
    launchAndroid(launchArgs, projectType) {
        let workingDirectory = launchArgs.cwd;
        let errorLogger = (message) => this.outputLogger(message, true);
        // Prepare the command line args
        let isDevice = launchArgs.target.toLowerCase() === 'device';
        let args = ['run', 'android', isDevice ? '--device' : '--emulator', '--verbose'];
        if (['device', 'emulator'].indexOf(launchArgs.target.toLowerCase()) === -1) {
            args.push(`--target=${launchArgs.target}`);
        }
        // Verify if we are using Ionic livereload
        if (launchArgs.ionicLiveReload) {
            if (projectType.ionic || projectType.ionic2) {
                // Livereload is enabled, let Ionic do the launch
                args.push('--livereload');
                return this.startIonicDevServer(launchArgs, args).then(() => void 0);
            }
            else {
                this.outputLogger(CordovaDebugAdapter.NO_LIVERELOAD_WARNING);
            }
        }
        let cordovaResult = extension_1.cordovaRunCommand(args, errorLogger, workingDirectory).then((output) => {
            let runOutput = output[0];
            let stderr = output[1];
            let errorMatch = /(ERROR.*)/.exec(runOutput);
            if (errorMatch) {
                errorLogger(runOutput);
                errorLogger(stderr);
                throw new Error(`Error running android`);
            }
            this.outputLogger(runOutput, "stdout");
            this.outputLogger('App successfully launched');
        });
        return cordovaResult;
    }
    attachAndroid(attachArgs) {
        let errorLogger = (message) => this.outputLogger(message, true);
        // Determine which device/emulator we are targeting
        let adbDevicesResult = this.runAdbCommand(['devices'], errorLogger)
            .then((devicesOutput) => {
            if (attachArgs.target.toLowerCase() === 'device') {
                let deviceMatch = /\n([^\t]+)\tdevice($|\n)/m.exec(devicesOutput.replace(/\r/g, ''));
                if (!deviceMatch) {
                    errorLogger(devicesOutput);
                    throw new Error('Unable to find device');
                }
                return deviceMatch[1];
            }
            else {
                let emulatorMatch = /\n(emulator[^\t]+)\tdevice($|\n)/m.exec(devicesOutput.replace(/\r/g, ''));
                if (!emulatorMatch) {
                    errorLogger(devicesOutput);
                    throw new Error('Unable to find emulator');
                }
                return emulatorMatch[1];
            }
        }, (err) => {
            let errorCode = err.code;
            if (errorCode && errorCode === 'ENOENT') {
                throw new Error('Unable to find adb. Please ensure it is in your PATH and re-open Visual Studio Code');
            }
            throw err;
        });
        let packagePromise = Q.nfcall(fs.readFile, path.join(attachArgs.cwd, 'platforms', 'android', 'AndroidManifest.xml'))
            .then((manifestContents) => {
            let parsedFile = elementtree.XML(manifestContents.toString());
            let packageKey = 'package';
            return parsedFile.attrib[packageKey];
        });
        return Q.all([packagePromise, adbDevicesResult]).spread((appPackageName, targetDevice) => {
            let getPidCommandArguments = ['-s', targetDevice, 'shell', 'ps'];
            let getSocketsCommandArguments = ['-s', targetDevice, 'shell', 'cat /proc/net/unix'];
            let findAbstractNameFunction = () => 
            // Get the pid from app package name
            this.runAdbCommand(getPidCommandArguments, errorLogger)
                .then((psResult) => {
                const lines = psResult.split('\n');
                for (const line of lines) {
                    const fields = line.split(/[ \r]+/);
                    if (fields.length < 9) {
                        continue;
                    }
                    if (fields[8] === appPackageName) {
                        return fields[1];
                    }
                }
            })
                .then(pid => this.runAdbCommand(getSocketsCommandArguments, errorLogger)
                .then((getSocketsResult) => {
                const lines = getSocketsResult.split('\n');
                for (const line of lines) {
                    const fields = line.split(/[ \r]/);
                    if (fields.length < 8) {
                        continue;
                    }
                    // flag = 00010000 (16) -> accepting connection
                    // state = 01 (1) -> unconnected
                    if (fields[3] !== '00010000' || fields[5] !== '01') {
                        continue;
                    }
                    const pathField = fields[7];
                    if (pathField.length < 1 || pathField[0] !== '@') {
                        continue;
                    }
                    if (pathField.indexOf('_devtools_remote') === -1) {
                        continue;
                    }
                    if (pathField === "@webview_devtools_remote_" + pid) {
                        // Matches the plain cordova webview format
                        return pathField.substr(1);
                    }
                    if (pathField === "@" + appPackageName + "_devtools_remote") {
                        // Matches the crosswalk format of "@PACKAGENAME_devtools_remote
                        return pathField.substr(1);
                    }
                }
            }));
            return CordovaDebugAdapter.retryAsync(findAbstractNameFunction, (match) => !!match, 5, 1, 5000, 'Unable to find localabstract name of cordova app')
                .then((abstractName) => {
                // Configure port forwarding to the app
                let forwardSocketCommandArguments = ['-s', targetDevice, 'forward', `tcp:${attachArgs.port}`, `localabstract:${abstractName}`];
                this.outputLogger('Forwarding debug port');
                return this.runAdbCommand(forwardSocketCommandArguments, errorLogger).then(() => {
                    this.adbPortForwardingInfo = { targetDevice, port: attachArgs.port };
                });
            });
        }).then(() => {
            let args = JSON.parse(JSON.stringify(attachArgs));
            args.webRoot = attachArgs.cwd;
            return args;
        });
    }
    launchIos(launchArgs, projectType) {
        if (os.platform() !== 'darwin') {
            return Q.reject('Unable to launch iOS on non-mac machines');
        }
        let workingDirectory = launchArgs.cwd;
        let errorLogger = (message) => this.outputLogger(message, true);
        this.outputLogger('Launching app (This may take a while)...');
        let iosDebugProxyPort = launchArgs.iosDebugProxyPort || 9221;
        let appStepLaunchTimeout = launchArgs.appStepLaunchTimeout || 5000;
        // Launch the app
        if (launchArgs.target.toLowerCase() === 'device') {
            // Verify if we are using Ionic livereload
            if (launchArgs.ionicLiveReload) {
                if (projectType.ionic || projectType.ionic2) {
                    // Livereload is enabled, let Ionic do the launch
                    let ionicArgs = ['run', '--device', 'ios', '--livereload'];
                    return this.startIonicDevServer(launchArgs, ionicArgs).then(() => void 0);
                }
                else {
                    this.outputLogger(CordovaDebugAdapter.NO_LIVERELOAD_WARNING);
                }
            }
            // cordova run ios does not terminate, so we do not know when to try and attach.
            // Instead, we try to launch manually using homebrew.
            return extension_1.cordovaRunCommand(['build', 'ios', '--device'], errorLogger, workingDirectory).then((output) => {
                let buildFolder = path.join(workingDirectory, 'platforms', 'ios', 'build', 'device');
                this.outputLogger(output[0], "stdout");
                this.outputLogger('Installing app on device');
                let installPromise = Q.nfcall(fs.readdir, buildFolder).then((files) => {
                    let ipaFiles = files.filter((file) => /\.ipa$/.test(file));
                    if (ipaFiles.length !== 0) {
                        return path.join(buildFolder, ipaFiles[0]);
                    }
                    // No .ipa was found, look for a .app to convert to .ipa using xcrun
                    let appFiles = files.filter((file) => /\.app$/.test(file));
                    if (appFiles.length === 0) {
                        throw new Error('Unable to find a .app or a .ipa to install');
                    }
                    let appFile = path.join(buildFolder, appFiles[0]);
                    let ipaFile = path.join(buildFolder, path.basename(appFile, path.extname(appFile)) + '.ipa'); // Convert [path]/foo.app to [path]/foo.ipa
                    let execArgs = ['-v', '-sdk', 'iphoneos', 'PackageApplication', `${appFile}`, '-o', `${ipaFile}`];
                    return extension_1.execCommand('xcrun', execArgs, errorLogger).then(() => ipaFile).catch((err) => {
                        throw new Error(`Error converting ${path.basename(appFile)} to .ipa`);
                    });
                }).then((ipaFile) => {
                    return extension_1.execCommand('ideviceinstaller', ['-i', ipaFile], errorLogger).catch((err) => {
                        let errorCode = err.code;
                        if (errorCode && errorCode === 'ENOENT') {
                            throw new Error('Unable to find ideviceinstaller. Please ensure it is in your PATH and re-open Visual Studio Code');
                        }
                        throw err;
                    });
                });
                return Q.all([cordovaIosDeviceLauncher_1.CordovaIosDeviceLauncher.getBundleIdentifier(workingDirectory), installPromise]);
            }).spread((appBundleId) => {
                // App is now built and installed. Try to launch
                this.outputLogger('Launching app');
                return cordovaIosDeviceLauncher_1.CordovaIosDeviceLauncher.startDebugProxy(iosDebugProxyPort).then(() => {
                    return cordovaIosDeviceLauncher_1.CordovaIosDeviceLauncher.startApp(appBundleId, iosDebugProxyPort, appStepLaunchTimeout);
                });
            }).then(() => void (0));
        }
        else {
            let target = launchArgs.target.toLowerCase() === 'emulator' ? null : launchArgs.target;
            let emulateArgs = ['emulate'];
            if (target) {
                emulateArgs.push('--target=' + target);
            }
            emulateArgs.push('ios');
            // Verify if we are using Ionic livereload
            if (launchArgs.ionicLiveReload) {
                if (projectType.ionic || projectType.ionic2) {
                    // Livereload is enabled, let Ionic do the launch
                    emulateArgs.push('--livereload');
                    return this.startIonicDevServer(launchArgs, emulateArgs).then(() => void 0);
                }
                else {
                    this.outputLogger(CordovaDebugAdapter.NO_LIVERELOAD_WARNING);
                }
            }
            return extension_1.cordovaRunCommand(emulateArgs, errorLogger, workingDirectory).then((output) => {
                this.outputLogger(output[0], "stdout");
            }).catch((err) => {
                if (target) {
                    return extension_1.cordovaRunCommand(['emulate', 'ios', '--list'], errorLogger, workingDirectory).then((output) => {
                        // List out available targets
                        errorLogger('Unable to run with given target.');
                        errorLogger(output[0].replace(/\*+[^*]+\*+/g, '')); // Print out list of targets, without ** RUN SUCCEEDED **
                        throw err;
                    });
                }
                throw err;
            });
        }
    }
    attachIos(attachArgs) {
        attachArgs.webkitRangeMin = attachArgs.webkitRangeMin || 9223;
        attachArgs.webkitRangeMax = attachArgs.webkitRangeMax || 9322;
        attachArgs.attachAttempts = attachArgs.attachAttempts || 5;
        attachArgs.attachDelay = attachArgs.attachDelay || 1000;
        // Start the tunnel through to the webkit debugger on the device
        this.outputLogger('Configuring debugging proxy');
        return cordovaIosDeviceLauncher_1.CordovaIosDeviceLauncher.startWebkitDebugProxy(attachArgs.port, attachArgs.webkitRangeMin, attachArgs.webkitRangeMax).then(() => {
            if (attachArgs.target.toLowerCase() === 'device') {
                return cordovaIosDeviceLauncher_1.CordovaIosDeviceLauncher.getBundleIdentifier(attachArgs.cwd)
                    .then(cordovaIosDeviceLauncher_1.CordovaIosDeviceLauncher.getPathOnDevice)
                    .then(path.basename);
            }
            else {
                return Q.nfcall(fs.readdir, path.join(attachArgs.cwd, 'platforms', 'ios', 'build', 'emulator')).then((entries) => {
                    let filtered = entries.filter((entry) => /\.app$/.test(entry));
                    if (filtered.length > 0) {
                        return filtered[0];
                    }
                    else {
                        throw new Error('Unable to find .app file');
                    }
                });
            }
        }).then((packagePath) => {
            return this.promiseGet(`http://localhost:${attachArgs.port}/json`, 'Unable to communicate with ios_webkit_debug_proxy').then((response) => {
                try {
                    let endpointsList = JSON.parse(response);
                    let devices = endpointsList.filter((entry) => attachArgs.target.toLowerCase() === 'device' ? entry.deviceId !== 'SIMULATOR'
                        : entry.deviceId === 'SIMULATOR');
                    let device = devices[0];
                    // device.url is of the form 'localhost:port'
                    return parseInt(device.url.split(':')[1], 10);
                }
                catch (e) {
                    throw new Error('Unable to find iOS target device/simulator. Please check that "Settings > Safari > Advanced > Web Inspector = ON" or try specifying a different "port" parameter in launch.json');
                }
            }).then((targetPort) => {
                let findWebviewFunc = () => {
                    return this.promiseGet(`http://localhost:${targetPort}/json`, 'Unable to communicate with target')
                        .then((response) => {
                        try {
                            let webviewsList = JSON.parse(response);
                            return webviewsList.filter((entry) => {
                                if (this.ionicDevServerUrl) {
                                    return entry.url.indexOf(this.ionicDevServerUrl) === 0;
                                }
                                else {
                                    return entry.url.indexOf(encodeURIComponent(packagePath)) !== -1;
                                }
                            });
                        }
                        catch (e) {
                            throw new Error('Unable to find target app');
                        }
                    });
                };
                return CordovaDebugAdapter.retryAsync(findWebviewFunc, (webviewList) => webviewList.length > 0, attachArgs.attachAttempts, 1, attachArgs.attachDelay, 'Unable to find webview')
                    .then((relevantViews) => {
                    return { port: targetPort, url: relevantViews[0].url };
                });
            });
        }).then(({ port, url }) => {
            let args = JSON.parse(JSON.stringify(attachArgs));
            args.port = port;
            args.webRoot = attachArgs.cwd;
            args.url = url;
            return args;
        });
    }
    launchSimulate(launchArgs, projectType, generator) {
        let simulateTelemetryPropts = {
            platform: launchArgs.platform,
            target: launchArgs.target,
            port: launchArgs.port,
            simulatePort: launchArgs.simulatePort
        };
        if (launchArgs.hasOwnProperty('livereload')) {
            simulateTelemetryPropts.livereload = launchArgs.livereload;
        }
        if (launchArgs.hasOwnProperty('forceprepare')) {
            simulateTelemetryPropts.forceprepare = launchArgs.forceprepare;
        }
        generator.add('simulateOptions', simulateTelemetryPropts, false);
        let messageSender = new messaging.ExtensionMessageSender(launchArgs.cwd);
        let simulateInfo;
        let getEditorsTelemetry = messageSender.sendMessage(messaging.ExtensionMessage.GET_VISIBLE_EDITORS_COUNT)
            .then((editorsCount) => {
            generator.add('visibleTextEditors', editorsCount, false);
        }).catch((e) => {
            this.outputLogger('Could not read the visible text editors. ' + this.getErrorMessage(e));
        });
        let launchSimulate = Q(void 0)
            .then(() => {
            let simulateOptions = this.convertLaunchArgsToSimulateArgs(launchArgs);
            return messageSender.sendMessage(messaging.ExtensionMessage.START_SIMULATE_SERVER, [simulateOptions, projectType]);
        }).then((simInfo) => {
            simulateInfo = simInfo;
            return this.connectSimulateDebugHost(simulateInfo);
        }).then(() => {
            return messageSender.sendMessage(messaging.ExtensionMessage.LAUNCH_SIM_HOST);
        }).then(() => {
            // Launch Chrome and attach
            launchArgs.url = simulateInfo.appHostUrl;
            launchArgs.userDataDir = path.join(settingsHelper_1.settingsHome(), CordovaDebugAdapter.CHROME_DATA_DIR);
            this.outputLogger('Attaching to app');
            return this.launchChrome(launchArgs);
        }).catch((e) => {
            this.outputLogger('An error occurred while attaching to the debugger. ' + this.getErrorMessage(e));
            throw e;
        }).then(() => void 0);
        return Q.all([launchSimulate, getEditorsTelemetry]);
    }
    resetSimulateViewport() {
        return this.attachedDeferred.promise.then(() => this.chrome.Emulation.clearDeviceMetricsOverride()).then(() => this.chrome.Emulation.setEmulatedMedia({ media: '' })).then(() => this.chrome.Emulation.resetPageScaleFactor());
    }
    changeSimulateViewport(data) {
        return this.attachedDeferred.promise.then(() => this.chrome.Emulation.setDeviceMetricsOverride({
            width: data.width,
            height: data.height,
            deviceScaleFactor: 0,
            mobile: true,
            fitWindow: true
        }));
    }
    connectSimulateDebugHost(simulateInfo) {
        // Connect debug-host to cordova-simulate
        let viewportResizeFailMessage = 'Viewport resizing failed. Please try again.';
        let simulateDeferred = Q.defer();
        let simulateConnectErrorHandler = (err) => {
            this.outputLogger(`Error connecting to the simulated app.`);
            simulateDeferred.reject(err);
        };
        this.simulateDebugHost = io.connect(simulateInfo.urlRoot);
        this.simulateDebugHost.on('connect_error', simulateConnectErrorHandler);
        this.simulateDebugHost.on('connect_timeout', simulateConnectErrorHandler);
        this.simulateDebugHost.on('connect', () => {
            this.simulateDebugHost.on('resize-viewport', (data) => {
                this.changeSimulateViewport(data).catch((err) => {
                    this.outputLogger(viewportResizeFailMessage, true);
                }).done();
            });
            this.simulateDebugHost.on('reset-viewport', () => {
                this.resetSimulateViewport().catch((err) => {
                    this.outputLogger(viewportResizeFailMessage, true);
                }).done();
            });
            this.simulateDebugHost.emit('register-debug-host', { handlers: ['reset-viewport', 'resize-viewport'] });
            simulateDeferred.resolve(void 0);
        });
        return simulateDeferred.promise;
    }
    convertLaunchArgsToSimulateArgs(launchArgs) {
        let result = {};
        result.platform = launchArgs.platform;
        result.target = launchArgs.target;
        result.port = launchArgs.simulatePort;
        result.livereload = launchArgs.livereload;
        result.forceprepare = launchArgs.forceprepare;
        result.simulationpath = launchArgs.simulateTempDir;
        result.corsproxy = launchArgs.corsproxy;
        return result;
    }
    launchServe(launchArgs, projectType) {
        let errorLogger = (message) => this.outputLogger(message, true);
        // Currently, "ionic serve" is only supported for Ionic projects
        if (!projectType.ionic && !projectType.ionic2) {
            let errorMessage = 'Serving to the browser is currently only supported for Ionic projects';
            errorLogger(errorMessage);
            return Q.reject(new Error(errorMessage));
        }
        // Set up "ionic serve" args
        let ionicServeArgs = [
            'serve',
            '--nobrowser'
        ];
        if (!launchArgs.ionicLiveReload) {
            ionicServeArgs.push('--nolivereload');
        }
        // Deploy app to browser
        return Q(void 0).then(() => {
            return this.startIonicDevServer(launchArgs, ionicServeArgs);
        }).then((devServerUrl) => {
            // Prepare Chrome launch args
            launchArgs.url = devServerUrl;
            launchArgs.userDataDir = path.join(settingsHelper_1.settingsHome(), CordovaDebugAdapter.CHROME_DATA_DIR);
            // Launch Chrome and attach
            this.outputLogger('Attaching to app');
            return this.launchChrome(launchArgs);
        });
    }
    /**
     * Starts an Ionic livereload server ("serve" or "run / emulate --livereload"). Returns a promise fulfilled with the full URL to the server.
     */
    startIonicDevServer(launchArgs, cliArgs) {
        if (launchArgs.devServerAddress) {
            cliArgs.push('--address', launchArgs.devServerAddress);
        }
        if (launchArgs.hasOwnProperty('devServerPort')) {
            if (typeof launchArgs.devServerPort === 'number' && launchArgs.devServerPort >= 0 && launchArgs.devServerPort <= 65535) {
                cliArgs.push('--port', launchArgs.devServerPort.toString());
            }
            else {
                return Q.reject(new Error('The value for "devServerPort" must be a number between 0 and 65535'));
            }
        }
        let isServe = cliArgs[0] === 'serve';
        let errorRegex = /error:.*/i;
        let serverReady = false;
        let appReady = false;
        let serverReadyTimeout = launchArgs.devServerTimeout || 30000;
        let appReadyTimeout = 120000; // If we're not serving, the app needs to build and deploy (and potentially start the emulator), which can be very long
        let serverDeferred = Q.defer();
        let appDeferred = Q.defer();
        let serverOut = '';
        let serverErr = '';
        const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
        let getServerErrorMessage = (channel) => {
            let errorMatch = errorRegex.exec(channel);
            if (errorMatch) {
                return 'Error in the Ionic live reload server:' + os.EOL + errorMatch[0];
            }
            return null;
        };
        let getRegexToResolveAppDefer = (cliArgs) => {
            // Now that the server is ready, listen for the app to be ready as well. For "serve", this is always true, because no build and deploy is involved. For android, we need to
            // wait until we encounter the "launch success", for iOS device, the server output is different and instead we need to look for:
            //
            // ios devices:
            // (lldb)     run
            // success
            //
            // ios simulators:
            // "build succeeded"
            let isIosDevice = cliArgs.indexOf('ios') !== -1 && cliArgs.indexOf('--device') !== -1;
            let isIosSimulator = cliArgs.indexOf('ios') !== -1 && cliArgs.indexOf('emulate') !== -1;
            let iosDeviceAppReadyRegex = /\(lldb\)\W+run\r?\nsuccess/;
            let iosSimulatorAppReadyRegex = /build succeeded/i;
            let appReadyRegex = /launch success/i;
            if (isIosDevice) {
                return iosDeviceAppReadyRegex;
            }
            if (isIosSimulator) {
                return iosSimulatorAppReadyRegex;
            }
            return appReadyRegex;
        };
        this.ionicLivereloadProcess = extension_1.cordovaStartCommand(cliArgs, launchArgs.cwd);
        this.ionicLivereloadProcess.on('error', (err) => {
            if (err.code === 'ENOENT') {
                serverDeferred.reject(new Error('Ionic not found, please run \'npm install –g ionic\' to install it globally'));
            }
            else {
                serverDeferred.reject(err);
            }
        });
        this.ionicLivereloadProcess.on('exit', (() => {
            this.ionicLivereloadProcess = null;
            let exitMessage = 'The Ionic live reload server exited unexpectedly';
            let errorMsg = getServerErrorMessage(serverErr);
            if (errorMsg) {
                // The Ionic live reload server has an error; check if it is related to the devServerAddress to give a better message
                if (errorMsg.indexOf('getaddrinfo ENOTFOUND') !== -1 || errorMsg.indexOf('listen EADDRNOTAVAIL') !== -1) {
                    exitMessage += os.EOL + 'Invalid address: please provide a valid IP address or hostname for the "devServerAddress" property in launch.json';
                }
                else {
                    exitMessage += os.EOL + errorMsg;
                }
            }
            if (!serverDeferred.promise.isPending() && !appDeferred.promise.isPending()) {
                // We are already debugging; disconnect the session
                this.outputLogger(exitMessage, true);
                this.disconnect();
                throw new Error(exitMessage);
            }
            else {
                // The Ionic dev server wasn't ready yet, so reject its promises
                serverDeferred.reject(new Error(exitMessage));
                appDeferred.reject(new Error(exitMessage));
            }
        }).bind(this));
        let serverOutputHandler = (data) => {
            serverOut += data.toString();
            this.outputLogger(data.toString(), "stdout");
            // Listen for the server to be ready. We check for the "Running dev server:  http://localhost:<port>/" and "dev server running: http://localhost:<port>/" strings to decide that.
            //
            // Example output of Ionic dev server:
            //
            // Running live reload server: undefined
            // Watching: 0=www/**/*, 1=!www/lib/**/*
            // Running dev server:  http://localhost:8100
            // Ionic server commands, enter:
            // restart or r to restart the client app from the root
            // goto or g and a url to have the app navigate to the given url
            // consolelogs or c to enable/disable console log output
            // serverlogs or s to enable/disable server log output
            // quit or q to shutdown the server and exit
            //
            // ionic $
            // Example output of Ionic dev server (for Ionic2):
            //
            // > ionic-hello-world@ ionic:serve <path>
            // > ionic-app-scripts serve "--v2" "--address" "0.0.0.0" "--port" "8100" "--livereload-port" "35729"
            // ionic-app-scripts
            // watch started
            // build dev started
            // clean started
            // clean finished
            // copy started
            // transpile started
            // transpile finished
            // webpack started
            // copy finished
            // webpack finished
            // sass started
            // sass finished
            // build dev finished
            // watch ready
            // dev server running: http://localhost:8100/
            const SERVER_URL_RE = /(dev server running|Running dev server):.*(http:\/\/.[^\s]*)/gmi;
            let matchResult = SERVER_URL_RE.exec(serverOut);
            if (!serverReady && matchResult) {
                serverReady = true;
                serverDeferred.resolve(void 0);
            }
            if (serverReady && !appReady) {
                let regex = getRegexToResolveAppDefer(cliArgs);
                if (isServe || regex.test(serverOut)) {
                    appReady = true;
                    appDeferred.resolve(matchResult[2]);
                }
            }
            if (/Address Selection:/.test(serverOut)) {
                // Ionic does not know which address to use for the dev server, and requires human interaction; error out and let the user know
                let errorMessage = 'Your machine has multiple network addresses. Please specify which one your device or emulator will use to communicate with the dev server by adding a "devServerAddress": "ADDRESS" property to .vscode/launch.json.';
                let addresses = [];
                let addressRegex = /(\d+\) .*)/gm;
                let match = addressRegex.exec(serverOut);
                while (match) {
                    addresses.push(match[1]);
                    match = addressRegex.exec(serverOut);
                }
                if (addresses) {
                    // Give the user the list of addresses that Ionic found
                    errorMessage += [' Available addresses:'].concat(addresses).join(os.EOL + ' ');
                }
                serverDeferred.reject(new Error(errorMessage));
            }
            let errorMsg = getServerErrorMessage(serverOut);
            if (errorMsg) {
                appDeferred.reject(new Error(errorMsg));
            }
        };
        this.ionicLivereloadProcess.stdout.on('data', serverOutputHandler);
        this.ionicLivereloadProcess.stderr.on('data', (data) => {
            serverErr += data.toString();
            let errorMsg = getServerErrorMessage(serverErr);
            if (errorMsg) {
                appDeferred.reject(new Error(errorMsg));
            }
        });
        this.outputLogger(`Starting Ionic dev server (live reload: ${launchArgs.ionicLiveReload})`);
        return serverDeferred.promise.timeout(serverReadyTimeout, `Starting the Ionic dev server timed out (${serverReadyTimeout} ms)`).then(() => {
            this.outputLogger('Building and deploying app');
            return appDeferred.promise.timeout(appReadyTimeout, `Building and deploying the app timed out (${appReadyTimeout} ms)`);
        }).then((ionicDevServerUrl) => {
            if (!ionicDevServerUrl) {
                return Q.reject(new Error('Unable to determine the Ionic dev server address, please try re-launching the debugger'));
            }
            // The dev server address is the captured group at index 1 of the match
            this.ionicDevServerUrl = ionicDevServerUrl;
            // When ionic 2 cli is installed, output includes ansi characters for color coded output.
            this.ionicDevServerUrl = this.ionicDevServerUrl.replace(ansiRegex, '');
            return Q(this.ionicDevServerUrl);
        });
    }
    static retryAsync(func, condition, maxRetries, iteration, delay, failure) {
        return func().then(result => {
            if (condition(result)) {
                return result;
            }
            if (iteration < maxRetries) {
                return Q.delay(delay).then(() => CordovaDebugAdapter.retryAsync(func, condition, maxRetries, iteration + 1, delay, failure));
            }
            throw new Error(failure);
        });
    }
    promiseGet(url, reqErrMessage) {
        let deferred = Q.defer();
        let req = http.get(url, function (res) {
            let responseString = '';
            res.on('data', (data) => {
                responseString += data.toString();
            });
            res.on('end', () => {
                deferred.resolve(responseString);
            });
        });
        req.on('error', (err) => {
            this.outputLogger(reqErrMessage);
            deferred.reject(err);
        });
        return deferred.promise;
    }
    cleanUp() {
        const errorLogger = (message) => this.outputLogger(message, true);
        if (this.chromeProc) {
            this.chromeProc.kill('SIGINT');
            this.chromeProc = null;
        }
        // Clean up this session's attach and launch args
        this.previousLaunchArgs = null;
        this.previousAttachArgs = null;
        // Stop ADB port forwarding if necessary
        let adbPortPromise;
        if (this.adbPortForwardingInfo) {
            const adbForwardStopArgs = ['-s', this.adbPortForwardingInfo.targetDevice,
                'forward',
                '--remove', `tcp:${this.adbPortForwardingInfo.port}`];
            adbPortPromise = this.runAdbCommand(adbForwardStopArgs, errorLogger)
                .then(() => void 0);
        }
        else {
            adbPortPromise = Q(void 0);
        }
        // Kill the Ionic dev server if necessary
        let killServePromise;
        if (this.ionicLivereloadProcess) {
            this.ionicLivereloadProcess.removeAllListeners('exit');
            killServePromise = extension_1.killChildProcess(this.ionicLivereloadProcess).finally(() => {
                this.ionicLivereloadProcess = null;
            });
        }
        else {
            killServePromise = Q(void 0);
        }
        // Clear the Ionic dev server URL if necessary
        if (this.ionicDevServerUrl) {
            this.ionicDevServerUrl = null;
        }
        // Close the simulate debug-host socket if necessary
        if (this.simulateDebugHost) {
            this.simulateDebugHost.close();
            this.simulateDebugHost = null;
        }
        // Wait on all the cleanups
        return Q.allSettled([adbPortPromise, killServePromise]).then(() => void 0);
    }
    onScriptParsed(script) {
        let sourceMapsEnabled = this.previousLaunchArgs && this.previousLaunchArgs.sourceMaps || this.previousAttachArgs && this.previousAttachArgs.sourceMaps;
        if (sourceMapsEnabled && !script.sourceMapURL && path.extname(script.url) === '.js') {
            // Browsers don't always report source maps for scripts, so even though no source map was reported for this script, parse it in case it has a sourceMappingUrl attribute.
            let clientPath = this.cordovaPathTransformer.getClientPath(script.url);
            if (clientPath) {
                let scriptContent = fs.readFileSync(clientPath).toString();
                let parsedSrcMapUrl = this.findSourceAttribute('sourceMappingURL', scriptContent);
                if (parsedSrcMapUrl) {
                    script.sourceMapURL = parsedSrcMapUrl;
                }
            }
        }
        return super.onScriptParsed(script);
    }
    launchChrome(args) {
        return super.launch(args).then(() => {
            const chromePath = args.runtimeExecutable || CordovaDebugAdapter.getBrowserPath();
            if (!chromePath) {
                return Promise.reject(new Error(`Can't find Chrome - install it or set the "runtimeExecutable" field in the launch config.`));
            }
            const port = args.port || 9222;
            const chromeArgs = ['--remote-debugging-port=' + port];
            chromeArgs.push(...['--no-first-run', '--no-default-browser-check']);
            if (args.runtimeArgs) {
                chromeArgs.push(...args.runtimeArgs);
            }
            if (args.userDataDir) {
                chromeArgs.push('--user-data-dir=' + args.userDataDir);
            }
            const launchUrl = args.url;
            chromeArgs.push(launchUrl);
            this.chromeProc = child_process.spawn(chromePath, chromeArgs, {
                detached: true,
                stdio: ['ignore']
            });
            this.chromeProc.unref();
            this.chromeProc.on('error', (err) => {
                const errMsg = 'Chrome error: ' + err;
                this.terminateSession(errMsg);
            });
            return this.doAttach(port, launchUrl, args.address).then(() => {
                this.attachedDeferred.resolve(void 0);
            });
        });
    }
    static getBrowserPath() {
        const platform = vscode_chrome_debug_core_1.utils.getPlatform();
        if (platform === 1 /* OSX */) {
            return vscode_chrome_debug_core_1.utils.existsSync(DEFAULT_CHROME_PATH.OSX) ? DEFAULT_CHROME_PATH.OSX : null;
        }
        else if (platform === 0 /* Windows */) {
            if (vscode_chrome_debug_core_1.utils.existsSync(DEFAULT_CHROME_PATH.WINx86)) {
                return DEFAULT_CHROME_PATH.WINx86;
            }
            else if (vscode_chrome_debug_core_1.utils.existsSync(DEFAULT_CHROME_PATH.WIN)) {
                return DEFAULT_CHROME_PATH.WIN;
            }
            else if (vscode_chrome_debug_core_1.utils.existsSync(DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA)) {
                return DEFAULT_CHROME_PATH.WIN_LOCALAPPDATA;
            }
            else {
                return null;
            }
        }
        else {
            return vscode_chrome_debug_core_1.utils.existsSync(DEFAULT_CHROME_PATH.LINUX) ? DEFAULT_CHROME_PATH.LINUX : null;
        }
    }
    /**
     * Initializes telemetry.
     */
    initializeTelemetry(projectRoot) {
        if (!this.telemetryInitialized) {
            this.telemetryInitialized = true;
            let version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf-8')).version;
            // Enable telemetry, forced on for now.
            return telemetry_1.Telemetry.init('cordova-tools-debug-adapter', version, { isExtensionProcess: false, projectRoot: projectRoot })
                .catch((e) => {
                this.outputLogger('Could not initialize telemetry.' + e.message || e.error || e.data || e);
            });
        }
        else {
            return Q.resolve(void 0);
        }
    }
    /**
     * Searches the specified code text for an attribute comment. Supported forms are line or
     * block comments followed by # (or @, though this is deprecated):
     * //# attribute=..., /*# attribute=... * /, //@ attribute=..., and /*@ attribute=... * /
     * @param attribute Name of the attribute to find
     * @param codeContent Source code to search for attribute comment
     * @return The attribute's value, or null if not exactly one is found
     */
    findSourceAttribute(attribute, codeContent) {
        if (codeContent) {
            let prefixes = ['//#', '/*#', '//@', '/*@'];
            let findString;
            let index = -1;
            let endIndex = -1;
            // Use pound-sign definitions first, but fall back to at-sign
            // The last instance of the attribute comment takes precedence
            for (var i = 0; index < 0 && i < prefixes.length; i++) {
                findString = '\n' + prefixes[i] + ' ' + attribute + '=';
                index = codeContent.lastIndexOf(findString);
            }
            if (index >= 0) {
                if (index >= 0) {
                    if (findString.charAt(2) === '*') {
                        endIndex = codeContent.indexOf('*/', index + findString.length);
                    }
                    else {
                        endIndex = codeContent.indexOf('\n', index + findString.length);
                    }
                    if (endIndex < 0) {
                        endIndex = codeContent.length;
                    }
                    return codeContent.substring(index + findString.length, endIndex).trim();
                }
            }
            return null;
        }
    }
    runAdbCommand(args, errorLogger) {
        const originalPath = process.env['PATH'];
        if (process.env['ANDROID_HOME']) {
            process.env['PATH'] += path.delimiter + path.join(process.env['ANDROID_HOME'], 'platform-tools');
        }
        return extension_1.execCommand('adb', args, errorLogger).finally(() => {
            process.env['PATH'] = originalPath;
        });
    }
    getErrorMessage(e) {
        return e.message || e.error || e.data || e;
    }
}
CordovaDebugAdapter.CHROME_DATA_DIR = 'chrome_sandbox_dir'; // The directory to use for the sandboxed Chrome instance that gets launched to debug the app
CordovaDebugAdapter.NO_LIVERELOAD_WARNING = 'Warning: Ionic live reload is currently only supported for Ionic 1 projects. Continuing deployment without Ionic live reload...';
CordovaDebugAdapter.SIMULATE_TARGETS = ['chrome', 'chromium', 'edge', 'firefox', 'ie', 'opera', 'safari'];
exports.CordovaDebugAdapter = CordovaDebugAdapter;

//# sourceMappingURL=cordovaDebugAdapter.js.map
