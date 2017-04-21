"use strict";
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require("vscode");
var fs = require("fs");
var path = require("path");
var os = require("os");
var stack = require("./stack");
var gitLocator_1 = require("./gitLocator");
var sorter_1 = require("./sorter");
var storage_1 = require("./storage");
var svnLocator_1 = require("./svnLocator");
var vscodeLocator_1 = require("./vscodeLocator");
var homeDir = os.homedir();
var homePathVariable = "$home";
var PROJECTS_FILE = "projects.json";
// vscode projects support
var MERGE_PROJECTS = true;
;
var vscLocator = new vscodeLocator_1.VisualStudioCodeLocator();
var gitLocator = new gitLocator_1.GitLocator();
var svnLocator = new svnLocator_1.SvnLocator();
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    var recentProjects = context.globalState.get("recent", "");
    var aStack = new stack.StringStack();
    aStack.fromString(recentProjects);
    // load the projects
    var projectStorage = new storage_1.ProjectStorage(getProjectFilePath());
    // register commands (here, because it needs to be used right below if an invalid JSON is present)
    vscode.commands.registerCommand("projectManager.saveProject", function () { return saveProject(); });
    vscode.commands.registerCommand("projectManager.refreshProjects", function () { return refreshProjects(); });
    vscode.commands.registerCommand("projectManager.editProjects", function () { return editProjects(); });
    vscode.commands.registerCommand("projectManager.listProjects", function () { return listProjects(false, [0 /* Projects */, 1 /* VSCode */, 2 /* Git */, 3 /* Svn */]); });
    vscode.commands.registerCommand("projectManager.listProjectsNewWindow", function () { return listProjects(true, [0 /* Projects */, 1 /* VSCode */, 2 /* Git */, 3 /* Svn */]); });
    loadProjectsFile();
    fs.watchFile(getProjectFilePath(), { interval: 100 }, function (prev, next) {
        loadProjectsFile();
    });
    //
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(function (cfg) {
        refreshProjects(false);
    }));
    var statusItem;
    showStatusBar();
    // function commands
    function showStatusBar(projectName) {
        var showStatusConfig = vscode.workspace.getConfiguration("projectManager").get("showProjectNameInStatusBar");
        var currentProjectPath = vscode.workspace.rootPath;
        if (!showStatusConfig || !currentProjectPath) {
            return;
        }
        if (!statusItem) {
            statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        }
        statusItem.text = "$(file-directory) ";
        statusItem.tooltip = currentProjectPath;
        if (vscode.workspace.getConfiguration("projectManager").get("openInNewWindow", true)) {
            statusItem.command = "projectManager.listProjectsNewWindow";
        }
        else {
            statusItem.command = "projectManager.listProjects";
        }
        // if we have a projectName, we don't need to search.
        if (projectName) {
            statusItem.text += projectName;
            statusItem.show();
            return;
        }
        if (projectStorage.length() === 0) {
            return;
        }
        var foundProject = projectStorage.existsWithRootPath(compactHomePath(currentProjectPath));
        if (foundProject) {
            statusItem.text += foundProject.name;
            statusItem.show();
        }
    }
    function refreshProjects(showMessage) {
        vscLocator.refreshProjects();
        gitLocator.refreshProjects();
        svnLocator.refreshProjects();
        if (showMessage) {
            vscode.window.showInformationMessage("The projects have been refreshed!");
        }
    }
    function editProjects() {
        if (fs.existsSync(getProjectFilePath())) {
            vscode.workspace.openTextDocument(getProjectFilePath()).then(function (doc) {
                vscode.window.showTextDocument(doc);
            });
        }
        else {
            var optionEditProject = {
                title: "Yes, edit manually"
            };
            vscode.window.showErrorMessage("No projects saved yet! You should open a folder and use Save Project instead. Do you really want to edit manually? ", optionEditProject).then(function (option) {
                // nothing selected
                if (typeof option === "undefined") {
                    return;
                }
                if (option.title === "Yes, edit manually") {
                    // var items = [];
                    // items.push({ label: 'Project Name', description: 'Project Path' });
                    // fs.writeFileSync(getProjectFilePath(), JSON.stringify(items, null, "\t"));
                    projectStorage.push("Project Name", "Root Path", "");
                    projectStorage.save();
                    vscode.commands.executeCommand("projectManager.editProjects");
                }
                else {
                    return;
                }
            });
        }
    }
    function saveProject() {
        // Display a message box to the user
        var wpath = vscode.workspace.rootPath;
        if (process.platform === "win32") {
            wpath = wpath.substr(wpath.lastIndexOf("\\") + 1);
        }
        else {
            wpath = wpath.substr(wpath.lastIndexOf("/") + 1);
        }
        // ask the PROJECT NAME (suggest the )
        var ibo = {
            prompt: "Project Name",
            placeHolder: "Type a name for your project",
            value: wpath
        };
        vscode.window.showInputBox(ibo).then(function (projectName) {
            if (typeof projectName === "undefined") {
                return;
            }
            // 'empty'
            if (projectName === "") {
                vscode.window.showWarningMessage("You must define a name for the project.");
                return;
            }
            var rootPath = compactHomePath(vscode.workspace.rootPath);
            // var items = []
            // if (fs.existsSync(getProjectFilePath())) {
            //     items = loadProjects(getProjectFilePath());
            //     if (items == null) {
            //         return;
            //     }
            // }
            // var found: boolean = false;
            // for (var i = 0; i < items.length; i++) {
            //     var element = items[i];
            //     if (element.label == projectName) {
            //         found = true;
            //     }
            // }
            if (!projectStorage.exists(projectName)) {
                aStack.push(projectName);
                context.globalState.update("recent", aStack.toString());
                projectStorage.push(projectName, rootPath, "");
                projectStorage.save();
                // items.push({ label: projectName, description: rootPath });
                // fs.writeFileSync(getProjectFilePath(), JSON.stringify(items, null, "\t"));
                vscode.window.showInformationMessage("Project saved!");
                showStatusBar(projectName);
            }
            else {
                var optionUpdate = {
                    title: "Update"
                };
                var optionCancel = {
                    title: "Cancel"
                };
                vscode.window.showInformationMessage("Project already exists!", optionUpdate, optionCancel).then(function (option) {
                    // nothing selected
                    if (typeof option === "undefined") {
                        return;
                    }
                    if (option.title === "Update") {
                        // for (var i = 0; i < items.length; i++) {
                        //     if (items[i].label == projectName) {
                        //         items[i].description = rootPath;
                        aStack.push(projectName);
                        context.globalState.update("recent", aStack.toString());
                        projectStorage.updateRootPath(projectName, rootPath);
                        projectStorage.save();
                        //                                fs.writeFileSync(getProjectFilePath(), JSON.stringify(items, null, "\t"));
                        vscode.window.showInformationMessage("Project saved!");
                        showStatusBar(projectName);
                        return;
                    }
                    else {
                        return;
                    }
                });
            }
        });
    }
    function sortProjectList(items) {
        var itemsToShow = expandHomePaths(items);
        itemsToShow = removeRootPath(itemsToShow);
        itemsToShow = indicateInvalidPaths(itemsToShow);
        var sortList = vscode.workspace.getConfiguration("projectManager").get("sortList", "Name");
        var newItemsSorted = sorter_1.ProjectsSorter.SortItemsByCriteria(itemsToShow, sortList, aStack);
        return newItemsSorted;
    }
    function getProjects(itemsSorted, sources) {
        return new Promise(function (resolve, reject) {
            if (sources.indexOf(0 /* Projects */) === -1) {
                resolve([]);
            }
            else {
                resolve(itemsSorted);
            }
        });
    }
    // Filters out any newDirectories entries that are present in knownDirectories.
    function filterKnownDirectories(knownDirectories, newDirectories) {
        if (knownDirectories) {
            newDirectories = newDirectories.filter(function (item) {
                return !knownDirectories.some(function (sortedItem) {
                    return expandHomePath(sortedItem.description).toLowerCase() === expandHomePath(item.fullPath).toLowerCase();
                });
            });
        }
        return Promise.resolve(newDirectories);
    }
    function getVSCodeProjects(itemsSorted, merge) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            vscLocator.locateProjects(vscode.workspace.getConfiguration("projectManager").get("vscode.baseFolders"))
                .then(filterKnownDirectories.bind(_this, merge ? itemsSorted : []))
                .then(function (dirList) {
                var newItems = [];
                newItems = dirList.map(function (item) {
                    return {
                        description: item.fullPath,
                        label: "$(file-code) " + item.name
                    };
                });
                if (merge) {
                    var unifiedList = newItems.concat(itemsSorted);
                    resolve(unifiedList);
                }
                else {
                    resolve(newItems);
                }
            });
        });
    }
    function getGitProjects(itemsSorted, merge) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            gitLocator.locateProjects(vscode.workspace.getConfiguration("projectManager").get("git.baseFolders"))
                .then(filterKnownDirectories.bind(_this, merge ? itemsSorted : []))
                .then(function (dirList) {
                var newItems = [];
                newItems = dirList.map(function (item) {
                    return {
                        label: "$(git-branch) " + item.name,
                        description: item.fullPath
                    };
                });
                if (merge) {
                    var unifiedList = newItems.concat(itemsSorted);
                    resolve(unifiedList);
                }
                else {
                    resolve(newItems);
                }
            });
        });
    }
    function getSvnProjects(itemsSorted, merge) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            svnLocator.locateProjects(vscode.workspace.getConfiguration("projectManager").get("svn.baseFolders"))
                .then(filterKnownDirectories.bind(_this, merge ? itemsSorted : []))
                .then(function (dirList) {
                var newItems = [];
                newItems = dirList.map(function (item) {
                    return {
                        label: "$(zap) " + item.name,
                        description: item.fullPath
                    };
                });
                if (merge) {
                    var unifiedList = newItems.concat(itemsSorted);
                    resolve(unifiedList);
                }
                else {
                    resolve(newItems);
                }
            });
        });
    }
    function listProjects(forceNewWindow, sources) {
        var items = [];
        // if (fs.existsSync(getProjectFilePath())) {
        //     items = loadProjects(getProjectFilePath());
        //     if (items == null) {
        //         return;
        //     }
        // } else {
        // if (projectStorage.length() == 0) {
        //     vscode.window.showInformationMessage('No projects saved yet!');
        //     return;
        // }
        items = projectStorage.map();
        function onRejectListProjects(reason) {
            vscode.window.showInformationMessage("Error loading projects: ${reason}");
        }
        // promisses
        function onResolve(selected) {
            if (!selected) {
                return;
            }
            // vscode.window.showInformationMessage(selected.label);
            if (!fs.existsSync(selected.description.toString())) {
                var optionUpdateProject = {
                    title: "Update Project"
                };
                var optionDeleteProject = {
                    title: "Delete Project"
                };
                vscode.window.showErrorMessage("The project has an invalid path. What would you like to do?", optionUpdateProject, optionDeleteProject).then(function (option) {
                    // nothing selected
                    if (typeof option === "undefined") {
                        return;
                    }
                    if (option.title === "Update Project") {
                        vscode.commands.executeCommand("projectManager.editProjects");
                    }
                    else {
                        // let itemsFiltered = [];
                        // itemsFiltered = items.filter(value => value.description.toString().toLowerCase() != selected.description.toLowerCase());
                        // fs.writeFileSync(getProjectFilePath(), JSON.stringify(itemsFiltered, null, "\t"));
                        projectStorage.pop(selected.label);
                        projectStorage.save();
                        return;
                    }
                });
            }
            else {
                // project path
                var projectPath = selected.description;
                projectPath = normalizePath(projectPath);
                // update MRU
                aStack.push(selected.label);
                context.globalState.update("recent", aStack.toString());
                var openInNewWindow = vscode.workspace.getConfiguration("projectManager").get("openInNewWindow", true);
                var uri = vscode.Uri.file(projectPath);
                vscode.commands.executeCommand("vscode.openFolder", uri, openInNewWindow || forceNewWindow)
                    .then(function (value) { return ({}); }, // done
                function (// done
                    value) { return vscode.window.showInformationMessage("Could not open the project!"); });
            }
        }
        var options = {
            matchOnDescription: false,
            matchOnDetail: false,
            placeHolder: "Loading Projects (pick one to open)"
        };
        getProjects(items, sources)
            .then(function (folders) {
            // not in SET
            if (sources.indexOf(1 /* VSCode */) === -1) {
                return folders;
            }
            // has PROJECTS and is NOT MERGED - always merge
            // if ((sources.indexOf(ProjectsSource.Projects) > -1)  && (!<boolean>vscode.workspace.getConfiguration('projectManager').get('vscode.mergeProjects', true))) {
            //     return folders;
            // }
            // Ok, can have VSCode
            var merge = MERGE_PROJECTS; // vscode.workspace.getConfiguration('projectManager').get('vscode.mergeProjects', true);
            return getVSCodeProjects(folders, merge);
        })
            .then(function (folders) {
            if (sources.indexOf(2 /* Git */) === -1) {
                return folders;
            }
            var merge = MERGE_PROJECTS;
            return getGitProjects(folders, merge);
        })
            .then(function (folders) {
            if (sources.indexOf(3 /* Svn */) === -1) {
                return folders;
            }
            var merge = MERGE_PROJECTS;
            return getSvnProjects(folders, merge);
        })
            .then(function (folders) {
            if (folders.length === 0) {
                vscode.window.showInformationMessage("No projects saved yet!");
                return;
            }
            else {
                vscode.window.showQuickPick(sortProjectList(folders), options)
                    .then(onResolve, onRejectListProjects);
            }
        });
    }
    function removeRootPath(items) {
        if (!vscode.workspace.rootPath) {
            return items;
        }
        else {
            return items.filter(function (value) { return value.description.toString().toLowerCase() !== vscode.workspace.rootPath.toLowerCase(); });
        }
    }
    function indicateInvalidPaths(items) {
        // for (let index = 0; index < items.length; index++) {
        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
            var element = items_1[_i];
            // let element = items[index];
            if (!element.detail && (!fs.existsSync(element.description.toString()))) {
                // items[index].detail = "$(circle-slash) Path does not exist";
                element.detail = "$(circle-slash) Path does not exist";
            }
        }
        return items;
    }
    function pathIsUNC(path) {
        return path.indexOf("\\\\") === 0;
    }
    /**
     * If the project path is in the user's home directory then store the home directory as a
     * parameter. This will help in situations when the user works with the same projects on
     * different machines, under different user names.
     */
    function compactHomePath(path) {
        if (path.indexOf(homeDir) === 0) {
            return path.replace(homeDir, homePathVariable);
        }
        return path;
    }
    /**
     * Expand $home parameter from path to real os home path
     */
    function expandHomePath(path) {
        if (path.indexOf(homePathVariable) === 0) {
            return path.replace(homePathVariable, homeDir);
        }
        return path;
    }
    function expandHomePaths(items) {
        return items.map(function (item) {
            item.description = expandHomePath(item.description);
            return item;
        });
    }
    function normalizePath(path) {
        var normalizedPath = path;
        if (!pathIsUNC(normalizedPath)) {
            var replaceable = normalizedPath.split("\\");
            normalizedPath = replaceable.join("\\\\");
        }
        return normalizedPath;
    }
    // function loadProjects(file: string): any[] {
    //     var items = [];
    //     try {
    //         items = JSON.parse(fs.readFileSync(file).toString());
    //         return items;
    //     } catch (error) {
    //         var optionOpenFile = <vscode.MessageItem>{
    //             title: "Open File"
    //         };
    //         vscode.window.showErrorMessage('Error loading projects.json file. Message: ' + error.toString(), optionOpenFile).then(option => {
    //             // nothing selected
    //             if (typeof option == 'undefined') {
    //                 return;
    //             }
    //             if (option.title == "Open File") {
    //                 vscode.commands.executeCommand('projectManager.editProjects');
    //             } else {
    //                 return;
    //             }
    //         });
    //         return null;
    //     }
    // }
    function getChannelPath() {
        if (vscode.env.appName.indexOf("Insiders") > 0) {
            return "Code - Insiders";
        }
        else {
            return "Code";
        }
    }
    function loadProjectsFile() {
        var errorLoading = projectStorage.load();
        // how to handle now, since the extension starts 'at load'?
        if (errorLoading !== "") {
            var optionOpenFile = {
                title: "Open File"
            };
            vscode.window.showErrorMessage("Error loading projects.json file. Message: " + errorLoading, optionOpenFile).then(function (option) {
                // nothing selected
                if (typeof option === "undefined") {
                    return;
                }
                if (option.title === "Open File") {
                    vscode.commands.executeCommand("projectManager.editProjects");
                }
                else {
                    return;
                }
            });
            return null;
        }
    }
    function getProjectFilePath() {
        var projectFile;
        var projectsLocation = vscode.workspace.getConfiguration("projectManager").get("projectsLocation");
        if (projectsLocation !== "") {
            projectFile = path.join(projectsLocation, PROJECTS_FILE);
        }
        else {
            var appdata = process.env.APPDATA || (process.platform === "darwin" ? process.env.HOME + "/Library/Application Support" : "/var/local");
            var channelPath = getChannelPath();
            projectFile = path.join(appdata, channelPath, "User", PROJECTS_FILE);
            // in linux, it may not work with /var/local, then try to use /home/myuser/.config
            if ((process.platform === "linux") && (!fs.existsSync(projectFile))) {
                projectFile = path.join(homeDir, ".config/", channelPath, "User", PROJECTS_FILE);
            }
        }
        return projectFile;
    }
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map