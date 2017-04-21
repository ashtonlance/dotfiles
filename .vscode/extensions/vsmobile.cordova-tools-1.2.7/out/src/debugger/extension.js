// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const child_process = require("child_process");
const cordovaProjectHelper_1 = require("../utils/cordovaProjectHelper");
const os = require("os");
const Q = require("q");
const util = require("util");
const TreeKill = require("tree-kill");
function execCommand(command, args, errorLogger) {
    let deferred = Q.defer();
    let proc = child_process.spawn(command, args, { stdio: 'pipe' });
    let stderr = '';
    let stdout = '';
    proc.stderr.on('data', (data) => {
        stderr += data.toString();
    });
    proc.stdout.on('data', (data) => {
        stdout += data.toString();
    });
    proc.on('error', (err) => {
        deferred.reject(err);
    });
    proc.on('close', (code) => {
        if (code !== 0) {
            errorLogger(stderr);
            errorLogger(stdout);
            deferred.reject(`Error running '${command} ${args.join(' ')}'`);
        }
        deferred.resolve(stdout);
    });
    return deferred.promise;
}
exports.execCommand = execCommand;
function cordovaRunCommand(args, errorLogger, cordovaRootPath) {
    let defer = Q.defer();
    let cliName = cordovaProjectHelper_1.CordovaProjectHelper.isIonicProject(cordovaRootPath) ? 'ionic' : 'cordova';
    let output = '';
    let stderr = '';
    let process = cordovaStartCommand(args, cordovaRootPath);
    process.stderr.on('data', data => {
        stderr += data.toString();
    });
    process.stdout.on('data', data => {
        output += data.toString();
    });
    process.on('exit', exitCode => {
        if (exitCode) {
            errorLogger(stderr);
            errorLogger(output);
            defer.reject(new Error(util.format('\'%s %s\' failed with exit code %d', cliName, args.join(' '), exitCode)));
        }
        else {
            defer.resolve([output, stderr]);
        }
    });
    process.on('error', error => {
        defer.reject(error);
    });
    return defer.promise;
}
exports.cordovaRunCommand = cordovaRunCommand;
function cordovaStartCommand(args, cordovaRootPath) {
    let cliName = cordovaProjectHelper_1.CordovaProjectHelper.isIonicProject(cordovaRootPath) ? 'ionic' : 'cordova';
    let commandExtension = os.platform() === 'win32' ? '.cmd' : '';
    let command = cliName + commandExtension;
    return child_process.spawn(command, args, { cwd: cordovaRootPath });
}
exports.cordovaStartCommand = cordovaStartCommand;
function killChildProcess(childProcess) {
    TreeKill(childProcess.pid, 'SIGKILL');
    return Q(void 0);
}
exports.killChildProcess = killChildProcess;

//# sourceMappingURL=extension.js.map
