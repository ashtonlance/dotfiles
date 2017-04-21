// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.
"use strict";
const path = require("path");
const fs = require("fs");
const Q = require("q");
const telemetryHelper_1 = require("./telemetryHelper");
const cordovaProjectHelper_1 = require("./cordovaProjectHelper");
class TsdHelper {
    static installTypeDefinitionFile(src, dest) {
        // Ensure that the parent folder exits; if not, create the hierarchy of directories
        let parentFolder = path.resolve(dest, "..");
        if (!cordovaProjectHelper_1.CordovaProjectHelper.existsSync(parentFolder)) {
            cordovaProjectHelper_1.CordovaProjectHelper.makeDirectoryRecursive(parentFolder);
        }
        return cordovaProjectHelper_1.CordovaProjectHelper.copyFile(src, dest);
    }
    /**
     *   Helper to install type defintion files for Cordova plugins and Ionic projects.
     *   {typingsFolderPath} - the parent folder where the type definitions need to be installed
     *   {typeDefsPath} - the relative paths of all plugin type definitions that need to be
     *                    installed (relative to <project_root>\.vscode\typings)
     */
    static installTypings(typingsFolderPath, typeDefsPath, projectRoot) {
        let installedTypeDefs = [];
        telemetryHelper_1.TelemetryHelper.generate('addTypings', (generator) => {
            generator.add('addedTypeDefinitions', typeDefsPath, false);
            return Q.all(typeDefsPath.map((relativePath) => {
                let src = path.resolve(TsdHelper.CORDOVA_TYPINGS_PATH, relativePath);
                let dest = path.resolve(typingsFolderPath, relativePath);
                // Check if we've previously copied these typings
                if (cordovaProjectHelper_1.CordovaProjectHelper.existsSync(dest)) {
                    return Q.resolve(void 0);
                }
                // Check if the user has these typings somewhere else in his project
                if (projectRoot) {
                    // We check for short path (e.g. projectRoot/typings/angular.d.ts) and long path (e.g. projectRoot/typings/angular/angular.d.ts)
                    let userTypingsShortPath = path.join(projectRoot, TsdHelper.USER_TYPINGS_FOLDERNAME, path.basename(relativePath));
                    let userTypingsLongPath = path.join(projectRoot, TsdHelper.USER_TYPINGS_FOLDERNAME, relativePath);
                    if (cordovaProjectHelper_1.CordovaProjectHelper.existsSync(userTypingsShortPath) || cordovaProjectHelper_1.CordovaProjectHelper.existsSync(userTypingsLongPath)) {
                        return Q.resolve(void 0);
                    }
                }
                return TsdHelper.installTypeDefinitionFile(src, dest)
                    .then(() => installedTypeDefs.push(dest));
            }));
        })
            .finally(() => {
            if (installedTypeDefs.length === 0)
                return;
            let typingsFolder = path.resolve(projectRoot, TsdHelper.USER_TYPINGS_FOLDERNAME);
            let indexFile = path.resolve(typingsFolder, 'cordova-typings.d.ts');
            // Ensure that the 'typings' folder exits; if not, create it
            if (!cordovaProjectHelper_1.CordovaProjectHelper.existsSync(typingsFolder)) {
                cordovaProjectHelper_1.CordovaProjectHelper.makeDirectoryRecursive(typingsFolder);
            }
            let references = cordovaProjectHelper_1.CordovaProjectHelper.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : '';
            let referencesToAdd = installedTypeDefs
                .filter(typeDef => cordovaProjectHelper_1.CordovaProjectHelper.existsSync(typeDef))
                .map(typeDef => path.relative(typingsFolder, typeDef))
                .filter(typeDef => references.indexOf(typeDef) < 0)
                .map(typeDef => `/// <reference path="${typeDef}"/>`);
            if (referencesToAdd.length === 0)
                return;
            fs.writeFileSync(indexFile, [references].concat(referencesToAdd).join('\n'), 'utf8');
        });
    }
    static removeTypings(typingsFolderPath, typeDefsToRemove, projectRoot) {
        if (typeDefsToRemove.length === 0)
            return;
        typeDefsToRemove.forEach(typeDef => {
            fs.unlink(path.resolve(typingsFolderPath, typeDef), err => {
                if (err)
                    console.error(err);
            });
        });
        let references = [];
        let indexFile = path.resolve(projectRoot, TsdHelper.USER_TYPINGS_FOLDERNAME, 'cordova-typings.d.ts');
        try {
            references = fs.readFileSync(indexFile, 'utf8').split('\n');
        }
        catch (e) {
            // We failed to read index file - it might not exist of
            // blocked by other process - can't do anything here
            return;
        }
        let referencesToPersist = references.filter(ref => 
        // Filter out references that we need to delete
        ref && !typeDefsToRemove.some(typedef => ref.indexOf(typedef) >= 0));
        referencesToPersist.length === 0 ?
            fs.unlink(indexFile) :
            // Write filtered references back to index file
            fs.writeFileSync(indexFile, referencesToPersist.join('\n'), 'utf8');
    }
}
TsdHelper.CORDOVA_TYPINGS_FOLDERNAME = "CordovaTypings";
TsdHelper.CORDOVA_TYPINGS_PATH = path.resolve(__dirname, "..", "..", "..", TsdHelper.CORDOVA_TYPINGS_FOLDERNAME);
TsdHelper.USER_TYPINGS_FOLDERNAME = "typings";
exports.TsdHelper = TsdHelper;

//# sourceMappingURL=tsdHelper.js.map
