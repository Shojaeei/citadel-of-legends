/* ==========================================================================
   Citadel of Legends - Desktop Shell (Electron)
   --------------------------------------------------------------------------
   Security posture (per Electron's security checklist):
     * contextIsolation + sandbox on, nodeIntegration off, webSecurity on
     * game served from a privileged custom scheme (app://) with path
       traversal protection and a strict CSP on every response
     * navigation and new windows blocked; https links open in the OS browser
     * no remote content, no telemetry, no auto-updater phoning home
   ========================================================================== */
const { app, BrowserWindow, protocol, shell, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { CSP, resolveAppPath, isSafeExternalUrl, mimeFor } = require('./security');

const APP_ROOT = path.join(__dirname, 'app');

protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

if (!app.requestSingleInstanceLock()) {
    app.quit();
}

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 960,
        minHeight: 600,
        backgroundColor: '#0c0a09',
        title: 'Citadel of Legends: Shattered Realms',
        icon: path.join(APP_ROOT, 'icons', 'icon-512.png'),
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webSecurity: true,
            spellcheck: false,
            devTools: !app.isPackaged
        }
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.loadURL('app://citadel/index.html');

    // Block in-app navigation away from the game and route https links to the OS browser.
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('app://citadel/')) {
            event.preventDefault();
            if (isSafeExternalUrl(url)) shell.openExternal(url);
        }
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isSafeExternalUrl(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    protocol.handle('app', async (request) => {
        const file = resolveAppPath(request.url, APP_ROOT);
        if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            return new Response('Not found', { status: 404 });
        }
        const body = await fs.promises.readFile(file);
        return new Response(body, {
            status: 200,
            headers: {
                'Content-Type': mimeFor(file),
                'Content-Security-Policy': CSP,
                'X-Content-Type-Options': 'nosniff'
            }
        });
    });

    // Deny all permission requests (camera, mic, geolocation, notifications...).
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

    Menu.setApplicationMenu(Menu.buildFromTemplate([
        ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
        { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
        { role: 'windowMenu' }
    ]));

    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
});
