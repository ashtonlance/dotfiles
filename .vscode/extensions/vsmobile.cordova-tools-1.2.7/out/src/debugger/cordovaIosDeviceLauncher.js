// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
'use strict';
const child_process = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const pl = require("plist");
const Q = require("q");
let promiseExec = Q.denodeify(child_process.exec);
class CordovaIosDeviceLauncher {
    static cleanup() {
        if (CordovaIosDeviceLauncher.nativeDebuggerProxyInstance) {
            CordovaIosDeviceLauncher.nativeDebuggerProxyInstance.kill('SIGHUP');
            CordovaIosDeviceLauncher.nativeDebuggerProxyInstance = null;
        }
        if (CordovaIosDeviceLauncher.webDebuggerProxyInstance) {
            CordovaIosDeviceLauncher.webDebuggerProxyInstance.kill();
            CordovaIosDeviceLauncher.webDebuggerProxyInstance = null;
        }
    }
    static getBundleIdentifier(projectRoot) {
        return Q.nfcall(fs.readdir, path.join(projectRoot, 'platforms', 'ios')).then((files) => {
            let xcodeprojfiles = files.filter((file) => /\.xcodeproj$/.test(file));
            if (xcodeprojfiles.length === 0) {
                throw new Error('Unable to find xcodeproj file');
            }
            let xcodeprojfile = xcodeprojfiles[0];
            let projectName = /^(.*)\.xcodeproj/.exec(xcodeprojfile)[1];
            let filepath = path.join(projectRoot, 'platforms', 'ios', projectName, projectName + '-Info.plist');
            let plist = pl.parse(fs.readFileSync(filepath, 'utf8'));
            return plist.CFBundleIdentifier;
        });
    }
    static startDebugProxy(proxyPort) {
        if (CordovaIosDeviceLauncher.nativeDebuggerProxyInstance) {
            CordovaIosDeviceLauncher.nativeDebuggerProxyInstance.kill('SIGHUP'); // idevicedebugserver does not exit from SIGTERM
            CordovaIosDeviceLauncher.nativeDebuggerProxyInstance = null;
        }
        return CordovaIosDeviceLauncher.mountDeveloperImage().then(function () {
            let deferred = Q.defer();
            CordovaIosDeviceLauncher.nativeDebuggerProxyInstance = child_process.spawn('idevicedebugserverproxy', [proxyPort.toString()]);
            CordovaIosDeviceLauncher.nativeDebuggerProxyInstance.on('error', function (err) {
                deferred.reject(err);
            });
            // Allow 200ms for the spawn to error out, ~125ms isn't uncommon for some failures
            Q.delay(200).then(() => deferred.resolve(CordovaIosDeviceLauncher.nativeDebuggerProxyInstance));
            return deferred.promise;
        });
    }
    static startWebkitDebugProxy(proxyPort, proxyRangeStart, proxyRangeEnd) {
        if (CordovaIosDeviceLauncher.webDebuggerProxyInstance) {
            CordovaIosDeviceLauncher.webDebuggerProxyInstance.kill();
            CordovaIosDeviceLauncher.webDebuggerProxyInstance = null;
        }
        let deferred = Q.defer();
        let portRange = `null:${proxyPort},:${proxyRangeStart}-${proxyRangeEnd}`;
        CordovaIosDeviceLauncher.webDebuggerProxyInstance = child_process.spawn('ios_webkit_debug_proxy', ['-c', portRange]);
        CordovaIosDeviceLauncher.webDebuggerProxyInstance.on('error', function (err) {
            deferred.reject(new Error('Unable to start ios_webkit_debug_proxy.'));
        });
        // Allow some time for the spawned process to error out
        Q.delay(250).then(() => deferred.resolve({}));
        return deferred.promise;
    }
    // Attempt to start the app on the device, using the debug server proxy on a given port.
    // Returns a socket speaking remote gdb protocol with the debug server proxy.
    static startApp(packageId, proxyPort, appLaunchStepTimeout) {
        // When a user has many apps installed on their device, the response from ideviceinstaller may be large (500k or more)
        // This exceeds the maximum stdout size that exec allows, so we redirect to a temp file.
        return CordovaIosDeviceLauncher.getPathOnDevice(packageId).then(function (path) { return CordovaIosDeviceLauncher.startAppViaDebugger(proxyPort, path, appLaunchStepTimeout); });
    }
    static getPathOnDevice(packageId) {
        return promiseExec('ideviceinstaller -l -o xml > /tmp/$$.ideviceinstaller && echo /tmp/$$.ideviceinstaller')
            .catch(function (err) {
            if (err.code === 'ENOENT') {
                throw new Error('Unable to find ideviceinstaller.');
            }
            throw err;
        }).spread(function (stdout, stderr) {
            // First find the path of the app on the device
            let filename = stdout.trim();
            if (!/^\/tmp\/[0-9]+\.ideviceinstaller$/.test(filename)) {
                throw new Error('Unable to list installed applications on device');
            }
            let list = pl.parse(fs.readFileSync(filename, 'utf8'));
            fs.unlink(filename);
            for (let i = 0; i < list.length; ++i) {
                if (list[i].CFBundleIdentifier === packageId) {
                    let path = list[i].Path;
                    return path;
                }
            }
            throw new Error('Application not installed on the device');
        });
    }
    static startAppViaDebugger(portNumber, packagePath, appLaunchStepTimeout) {
        let encodedPath = CordovaIosDeviceLauncher.encodePath(packagePath);
        // We need to send 3 messages to the proxy, waiting for responses between each message:
        // A(length of encoded path),0,(encoded path)
        // Hc0
        // c
        // We expect a '+' for each message sent, followed by a $OK#9a to indicate that everything has worked.
        // For more info, see http://www.opensource.apple.com/source/lldb/lldb-167.2/docs/lldb-gdb-remote.txt
        let socket = new net.Socket();
        let initState = 0;
        let endStatus = null;
        let endSignal = null;
        let deferred1 = Q.defer();
        let deferred2 = Q.defer();
        let deferred3 = Q.defer();
        socket.on('data', function (data) {
            data = data.toString();
            while (data[0] === '+') {
                data = data.substring(1);
            }
            // Acknowledge any packets sent our way
            if (data[0] === '$') {
                socket.write('+');
                if (data[1] === 'W') {
                    // The app process has exited, with hex status given by data[2-3]
                    let status = parseInt(data.substring(2, 4), 16);
                    endStatus = status;
                    socket.end();
                }
                else if (data[1] === 'X') {
                    // The app rocess exited because of signal given by data[2-3]
                    let signal = parseInt(data.substring(2, 4), 16);
                    endSignal = signal;
                    socket.end();
                }
                else if (data.substring(1, 3) === 'OK') {
                    // last command was received OK;
                    if (initState === 1) {
                        deferred1.resolve(socket);
                    }
                    else if (initState === 2) {
                        deferred2.resolve(socket);
                    }
                    else if (initState === 3) {
                        // iOS 10 no longer responds with output O message, so we assume the app is started after the device acknowledges our request to begin execution.
                        deferred3.resolve(socket);
                        initState++;
                    }
                }
                else if (data[1] === 'O') {
                    // STDOUT was written to, and the rest of the input until reaching a '#' is a hex-encoded string of that output
                    if (initState === 3) {
                        deferred3.resolve(socket);
                        initState++;
                    }
                }
                else if (data[1] === 'E') {
                    // An error has occurred, with error code given by data[2-3]: parseInt(data.substring(2, 4), 16)
                    deferred1.reject('Unable to launch application.');
                    deferred2.reject('Unable to launch application.');
                    deferred3.reject('Unable to launch application.');
                }
            }
            else if (data === '' && initState === 3) {
                // On iOS 10.2.1 (and maybe others) after 'c' message debug server doesn't respond with '$OK', see also
                // http://www.embecosm.com/appnotes/ean4/embecosm-howto-rsp-server-ean4-issue-2.html#sec_exchange_cont
                deferred3.resolve(socket);
                initState++;
            }
        });
        socket.on('end', function () {
            deferred1.reject('Unable to launch application.');
            deferred2.reject('Unable to launch application.');
            deferred3.reject('Unable to launch application.');
        });
        socket.on('error', function (err) {
            deferred1.reject(err);
            deferred2.reject(err);
            deferred3.reject(err);
        });
        socket.connect(portNumber, 'localhost', function () {
            // set argument 0 to the (encoded) path of the app
            let cmd = CordovaIosDeviceLauncher.makeGdbCommand('A' + encodedPath.length + ',0,' + encodedPath);
            initState++;
            socket.write(cmd);
            setTimeout(function () {
                deferred1.reject('Timeout launching application. Is the device locked?');
            }, appLaunchStepTimeout);
        });
        return deferred1.promise.then(function (sock) {
            // Set the step and continue thread to any thread
            let cmd = CordovaIosDeviceLauncher.makeGdbCommand('Hc0');
            initState++;
            sock.write(cmd);
            setTimeout(function () {
                deferred2.reject('Timeout launching application. Is the device locked?');
            }, appLaunchStepTimeout);
            return deferred2.promise;
        }).then(function (sock) {
            // Continue execution; actually start the app running.
            let cmd = CordovaIosDeviceLauncher.makeGdbCommand('c');
            initState++;
            sock.write(cmd);
            setTimeout(function () {
                deferred3.reject('Timeout launching application. Is the device locked?');
            }, appLaunchStepTimeout);
            return deferred3.promise;
        }).then(() => packagePath);
    }
    static encodePath(packagePath) {
        // Encode the path by converting each character value to hex
        return packagePath.split('').map((c) => c.charCodeAt(0).toString(16)).join('').toUpperCase();
    }
    static mountDeveloperImage() {
        return CordovaIosDeviceLauncher.getDiskImage()
            .then(function (path) {
            let imagemounter = child_process.spawn('ideviceimagemounter', [path]);
            let deferred = Q.defer();
            let stdout = '';
            imagemounter.stdout.on('data', function (data) {
                stdout += data.toString();
            });
            imagemounter.on('close', function (code) {
                if (code !== 0) {
                    if (stdout.indexOf('Error:') !== -1) {
                        deferred.resolve({}); // Technically failed, but likely caused by the image already being mounted.
                    }
                    else if (stdout.indexOf('No device found, is it plugged in?') !== -1) {
                        deferred.reject('Unable to find device. Is the device plugged in?');
                    }
                    deferred.reject('Unable to mount developer disk image.');
                }
                else {
                    deferred.resolve({});
                }
            });
            imagemounter.on('error', function (err) {
                deferred.reject(err);
            });
            return deferred.promise;
        });
    }
    static getDiskImage() {
        // Attempt to find the OS version of the iDevice, e.g. 7.1
        let versionInfo = promiseExec('ideviceinfo -s -k ProductVersion')
            .spread(function (stdout, stderr) {
            // Versions for DeveloperDiskImage seem to be X.Y, while some device versions are X.Y.Z
            return /^(\d+\.\d+)(?:\.\d+)?$/gm.exec(stdout.trim())[1];
        })
            .catch(function () {
            throw new Error('Unable to get device OS version');
        });
        // Attempt to find the path where developer resources exist.
        let pathInfo = promiseExec('xcrun -sdk iphoneos --show-sdk-platform-path').spread(function (stdout, stderr) {
            let sdkpath = stdout.trim();
            return sdkpath;
        });
        // Attempt to find the developer disk image for the appropriate
        return Q.all([versionInfo, pathInfo]).spread(function (version, sdkpath) {
            let find = child_process.spawn('find', [sdkpath, '-path', '*' + version + '*', '-name', 'DeveloperDiskImage.dmg']);
            let deferred = Q.defer();
            find.stdout.on('data', function (data) {
                let dataStr = data.toString();
                let path = dataStr.split('\n')[0].trim();
                if (!path) {
                    deferred.reject('Unable to find developer disk image');
                }
                else {
                    deferred.resolve(path);
                }
            });
            find.on('close', function (code) {
                deferred.reject('Unable to find developer disk image');
            });
            return deferred.promise;
        });
    }
    static makeGdbCommand(command) {
        let commandString = '$' + command + '#';
        let stringSum = 0;
        for (let i = 0; i < command.length; i++) {
            stringSum += command.charCodeAt(i);
        }
        /* tslint:disable:no-bitwise */
        // We need some bitwise operations to calculate the checksum
        stringSum = stringSum & 0xFF;
        /* tslint:enable:no-bitwise */
        let checksum = stringSum.toString(16).toUpperCase();
        if (checksum.length < 2) {
            checksum = '0' + checksum;
        }
        commandString += checksum;
        return commandString;
    }
}
exports.CordovaIosDeviceLauncher = CordovaIosDeviceLauncher;
process.on('exit', CordovaIosDeviceLauncher.cleanup);

//# sourceMappingURL=cordovaIosDeviceLauncher.js.map
