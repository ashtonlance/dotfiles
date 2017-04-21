"use strict";
var walker = require("walker");
var path = require("path");
var fs = require("fs");
var vscode = require("vscode");
var os = require("os");
var homeDir = os.homedir();
var CACHE_FILE = "projects_cache_";
;
var AbstractLocator = (function () {
    function AbstractLocator() {
        var _this = this;
        this.dirList = [];
        this.processDirectory = function (absPath, stat) {
            vscode.window.setStatusBarMessage(absPath, 600);
            if (_this.isRepoDir(absPath)) {
                _this.addToList(absPath, _this.decideProjectName(absPath));
            }
        };
        this.maxDepth = -1;
        this.ignoredFolders = [];
        this.useCachedProjects = true;
        this.alreadyLocated = false;
    }
    AbstractLocator.prototype.getPathDepth = function (s) {
        return s.split(path.sep).length;
    };
    AbstractLocator.prototype.isMaxDeptReached = function (currentDepth, initialDepth) {
        return (this.maxDepth > 0) && ((currentDepth - initialDepth) > this.maxDepth);
    };
    AbstractLocator.prototype.isFolderIgnored = function (folder) {
        return this.ignoredFolders.indexOf(folder) !== -1;
    };
    AbstractLocator.prototype.isAlreadyLocated = function () {
        return this.useCachedProjects && this.alreadyLocated;
    };
    AbstractLocator.prototype.setAlreadyLocated = function (al) {
        if (this.useCachedProjects) {
            this.alreadyLocated = al;
            if (this.alreadyLocated) {
                var cacheFile = this.getCacheFile();
                fs.writeFileSync(cacheFile, JSON.stringify(this.dirList, null, "\t"), { encoding: "utf8" });
            }
        }
    };
    AbstractLocator.prototype.clearDirList = function () {
        this.dirList = [];
    };
    AbstractLocator.prototype.initializeCfg = function (kind) {
        this.ignoredFolders = vscode.workspace.getConfiguration("projectManager").get(kind + ".ignoredFolders", []);
        this.maxDepth = vscode.workspace.getConfiguration("projectManager").get(kind + ".maxDepthRecursion", -1);
        this.useCachedProjects = vscode.workspace.getConfiguration("projectManager").get("cacheProjectsBetweenSessions", true);
        if (!this.useCachedProjects) {
            this.clearDirList();
        }
        else {
            var cacheFile = this.getCacheFile();
            if (fs.existsSync(cacheFile)) {
                this.dirList = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
                this.setAlreadyLocated(true);
            }
        }
    };
    AbstractLocator.prototype.locateProjects = function (projectsDirList) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (projectsDirList.length === 0) {
                resolve([]);
                return;
            }
            _this.initializeCfg(_this.getKind());
            if (_this.isAlreadyLocated()) {
                resolve(_this.dirList);
                return;
            }
            var promises = [];
            _this.clearDirList();
            projectsDirList.forEach(function (projectBasePath) {
                if (!fs.existsSync(projectBasePath)) {
                    vscode.window.setStatusBarMessage("Directory " + projectBasePath + " does not exists.", 1500);
                    return;
                }
                var depth = _this.getPathDepth(projectBasePath);
                var promise = new Promise(function (resolve, reject) {
                    try {
                        walker(projectBasePath)
                            .filterDir(function (dir, stat) {
                            return !(_this.isFolderIgnored(path.basename(dir)) ||
                                _this.isMaxDeptReached(_this.getPathDepth(dir), depth));
                        })
                            .on("dir", _this.processDirectory)
                            .on("error", _this.handleError)
                            .on("end", function () {
                            resolve();
                        });
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                promises.push(promise);
            });
            Promise.all(promises)
                .then(function () {
                vscode.window.setStatusBarMessage("Searching folders completed", 1500);
                _this.setAlreadyLocated(true);
                resolve(_this.dirList);
            })
                .catch(function (error) { vscode.window.showErrorMessage("Error while loading projects."); });
        });
    };
    AbstractLocator.prototype.addToList = function (projectPath, projectName) {
        if (projectName === void 0) { projectName = null; }
        this.dirList.push({
            fullPath: projectPath,
            name: projectName === null ? path.basename(projectPath) : projectName });
        return;
    };
    AbstractLocator.prototype.handleError = function (err) {
        console.log("Error walker:", err);
    };
    AbstractLocator.prototype.refreshProjects = function () {
        this.clearDirList();
        var cacheFile = this.getCacheFile();
        if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
        }
        this.setAlreadyLocated(false);
    };
    AbstractLocator.prototype.getChannelPath = function () {
        if (vscode.env.appName.indexOf("Insiders") > 0) {
            return "Code - Insiders";
        }
        else {
            return "Code";
        }
    };
    AbstractLocator.prototype.getCacheFile = function () {
        var cacheFile;
        var appdata = process.env.APPDATA || (process.platform === "darwin" ? process.env.HOME + "/Library/Application Support" : "/var/local");
        var channelPath = this.getChannelPath();
        cacheFile = path.join(appdata, channelPath, "User", CACHE_FILE + this.getKind() + ".json");
        if ((process.platform === "linux") && (!fs.existsSync(cacheFile))) {
            cacheFile = path.join(homeDir, ".config/", channelPath, "User", CACHE_FILE + this.getKind() + ".json");
        }
        return cacheFile;
    };
    return AbstractLocator;
}());
exports.AbstractLocator = AbstractLocator;
//# sourceMappingURL=abstractLocator.js.map