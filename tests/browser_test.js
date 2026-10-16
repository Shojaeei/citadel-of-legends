const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'file:///d:/Citadel%20of%20Legends/index.html';
const port = 9222;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function runBrowserTest() {
    console.log("Starting Chrome in headless mode with remote debugging...");
    const chromeProc = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1280,720',
        '--disable-gpu',
        '--no-sandbox',
        targetUrl
    ]);

    chromeProc.stderr.on('data', d => {
        // console.log(`[Chrome stderr]: ${d.toString().slice(0, 100)}`);
    });

    // Wait for debugging port
    let targets = null;
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        try {
            targets = await fetchJson(`http://127.0.0.1:${port}/json`);
            if (targets && targets.length > 0) break;
        } catch (e) {}
    }

    if (!targets || targets.length === 0) {
        console.error("Failed to connect to Chrome debugging endpoint!");
        chromeProc.kill();
        process.exit(1);
    }

    const pageTarget = targets.find(t => t.type === 'page');
    console.log("Connected to page target:", pageTarget.title, pageTarget.url);

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();
    const consoleLogs = [];

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            callbacks.get(msg.id)(msg);
            callbacks.delete(msg.id);
        } else if (msg.method === 'Runtime.consoleAPICalled') {
            consoleLogs.push({ type: msg.params.type, args: msg.params.args.map(a => a.value || a.description) });
            console.log(`[Browser Console ${msg.params.type}]:`, ...msg.params.args.map(a => a.value || a.description));
        } else if (msg.method === 'Runtime.exceptionThrown') {
            console.error(`[Browser Exception]:`, msg.params.exceptionDetails);
        }
    };

    function send(method, params = {}) {
        return new Promise((resolve) => {
            const reqId = id++;
            callbacks.set(reqId, resolve);
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');
    await send('Page.enable');
    await send('DOM.enable');

    console.log("Page runtime enabled. Evaluating page state...");
    await sleep(1000);

    // 1. Check title and GameApp availability
    const evalResult = await send('Runtime.evaluate', {
        expression: `({
            title: document.title,
            hasGameApp: typeof window.GameApp !== 'undefined',
            mainMenuVisible: !document.getElementById('main-menu').classList.contains('hidden'),
            gameInterfaceVisible: !document.getElementById('game-interface').classList.contains('hidden'),
            canvasWidth: document.getElementById('game-canvas').width,
            canvasHeight: document.getElementById('game-canvas').height,
            canvasClientWidth: document.getElementById('game-canvas').clientWidth,
            canvasClientHeight: document.getElementById('game-canvas').clientHeight
        })`,
        returnByValue: true
    });

    console.log("Initial Page State:", evalResult.result.value);

    // 2. Click Campaign Button then launch Solaris campaign
    console.log("Triggering GameApp.startCampaign('solaris', 1)...");
    const launchResult = await send('Runtime.evaluate', {
        expression: `(function() {
            GameApp.startCampaign('solaris', 1);
            const canvas = document.getElementById('game-canvas');
            return JSON.stringify({
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                canvasClientWidth: canvas.clientWidth,
                canvasClientHeight: canvas.clientHeight,
                camera: GameApp.camera,
                playerKeep: GameApp.playerKeep ? { gx: GameApp.playerKeep.gx, gy: GameApp.playerKeep.gy, w: GameApp.playerKeep.w, h: GameApp.playerKeep.h } : null,
                buildings: GameApp.buildings.length,
                units: GameApp.units.length,
                rendererHover: GameApp.renderer ? GameApp.renderer.hoverTile : null
            });
        })()`,
        returnByValue: true
    });

    // Simulate active gameplay: Place a building, train a unit, and open dev console
    console.log("Simulating interactive player actions: building placement & unit training...");
    const actionResult = await send('Runtime.evaluate', {
        expression: `(function() {
            // Select Hovel
            GameApp.selectTool('hovel');
            // Place hovel near keep at (16, 26)
            GameApp.tryPlaceBuilding(16, 26);
            
            // Switch to military tab and train an archer
            GameApp.setTab('military');
            GameApp.trainUnit('archer');

            // Train a halberdier
            GameApp.trainUnit('halberdier');

            return {
                buildingsCount: GameApp.buildings.length,
                unitsCount: GameApp.units.length,
                woodRemaining: GameApp.economy.res.wood,
                goldRemaining: GameApp.economy.res.gold,
                hovelPlaced: GameApp.buildings.some(b => b.type === 'hovel')
            };
        })()`,
        returnByValue: true
    });

    console.log("Interactive Action Result:", actionResult.result.value);

    // Let simulation run for 2 seconds to see troops and building in action
    await sleep(2000);

    // Capture screenshot of the gameplay in progress
    console.log("Capturing in-game action screenshot...");
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.result.data, 'base64');
    const screenshotPath = path.join(__dirname, 'gameplay_action.png');
    fs.writeFileSync(screenshotPath, buffer);
    console.log(`Action screenshot saved to ${screenshotPath} (${buffer.length} bytes)`);

    ws.close();
    chromeProc.kill();

    console.log("Browser test complete!");
}

runBrowserTest().catch(err => {
    console.error("Test failed with error:", err);
    process.exit(1);
});
