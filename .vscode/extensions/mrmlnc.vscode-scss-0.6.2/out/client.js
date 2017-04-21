'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
function activate(context) {
    const serverModule = path.join(__dirname, 'server.js');
    const debugOptions = {
        execArgv: ['--nolazy', '--debug=6004']
    };
    const serverOptions = {
        run: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
            options: debugOptions
        }
    };
    const activeEditor = vscode.window.activeTextEditor;
    const clientOptions = {
        documentSelector: ['scss'],
        synchronize: {
            configurationSection: ['scss'],
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.scss')
        },
        initializationOptions: {
            settings: vscode.workspace.getConfiguration('scss'),
            activeEditorUri: activeEditor ? activeEditor.document.uri.toString() : null
        }
    };
    const client = new vscode_languageclient_1.LanguageClient('scss-intellisense', 'SCSS IntelliSense', serverOptions, clientOptions);
    const disposable = [];
    disposable[0] = client.start();
    disposable[1] = vscode.window.onDidChangeActiveTextEditor((event) => {
        let uri = null;
        if (event && event.document.uri.scheme === 'file') {
            uri = event.document.uri.toString();
        }
        client.sendRequest('changeActiveDocument', { uri });
    });
    context.subscriptions.push(...disposable);
}
exports.activate = activate;
