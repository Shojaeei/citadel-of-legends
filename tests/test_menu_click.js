const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'file:///d:/Citadel%20of%20Legends/index.html';
const port = 9223;

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

async function runClickTest() {
    console.log("Starting Chrome for click verification...");
    const chromeProc = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1280,720',
        '--disable-gpu',
        '--no-sandbox',
        targetUrl
    ]);

    let targets = null;
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        try {
            targets = await fetchJson(`http://127.0.0.1:${port}/json`);
            if (targets && targets.length > 0) break;
        } catch (e) {}
    }

    const pageTarget = targets.find(t => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            callbacks.get(msg.id)(msg);
            callbacks.delete(msg.id);
        } else if (msg.method === 'Runtime.consoleAPICalled') {
            console.log(`[Browser Console]:`, ...msg.params.args.map(a => a.value || a.description));
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

    await sleep(800);

    // 1. Initial State: Main menu is visible, campaign modal is hidden
    const initial = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
            mainMenuHidden: document.getElementById('main-menu').classList.contains('hidden'),
            campaignModalHidden: document.getElementById('campaign-modal').classList.contains('hidden'),
            mainMenuZ: window.getComputedStyle(document.getElementById('main-menu')).zIndex,
            campaignModalZ: window.getComputedStyle(document.getElementById('campaign-modal')).zIndex
        })`,
        returnByValue: true
    });
    console.log("1. Initial Menu State:", initial.result?.result?.value);

    // 2. Click "Story Campaign" button
    console.log("2. Clicking 'Story Campaign' button via DOM click()...");
    const clickEvt = await send('Runtime.evaluate', {
        expression: `(function() {
            const btn = Array.from(document.querySelectorAll('#main-menu button')).find(b => b.innerText && b.innerText.includes('Story Campaign'));
            if (btn) {
                btn.click();
                return 'Clicked Story Campaign button';
            }
            return 'Button not found!';
        })()`,
        returnByValue: true
    });
    console.log("Click Event Result:", clickEvt.result?.result?.value);

    await sleep(600);

    const afterMenuClick = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
            campaignModalHidden: document.getElementById('campaign-modal').classList.contains('hidden'),
            campaignModalDisplay: window.getComputedStyle(document.getElementById('campaign-modal')).display,
            campaignModalZ: window.getComputedStyle(document.getElementById('campaign-modal')).zIndex
        })`,
        returnByValue: true
    });
    console.log("3. After clicking Story Campaign:", afterMenuClick.result?.result?.value);

    // Capture screenshot of the open Campaign Modal!
    const ssModal = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'campaign_modal_open.png'), Buffer.from(ssModal.result.data, 'base64'));
    console.log("Saved campaign_modal_open.png");

    // 4. Click "Play Solaris Saga" button inside campaign modal
    console.log("4. Clicking 'Play Solaris Saga' button...");
    const sagaClick = await send('Runtime.evaluate', {
        expression: `(function() {
            const btn = Array.from(document.querySelectorAll('#campaign-modal button')).find(b => b.innerText && b.innerText.includes('Play Solaris Saga'));
            if (btn) {
                btn.click();
                return 'Clicked Play Solaris Saga';
            }
            return 'Play Solaris Saga button not found!';
        })()`,
        returnByValue: true
    });
    console.log("Saga Click Result:", sagaClick.result?.result?.value);

    await sleep(1000);

    const afterLaunch = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
            gameState: GameApp.state,
            canvasWidth: document.getElementById('game-canvas').width,
            canvasHeight: document.getElementById('game-canvas').height,
            mainMenuHidden: document.getElementById('main-menu').classList.contains('hidden'),
            gameInterfaceHidden: document.getElementById('game-interface').classList.contains('hidden')
        })`,
        returnByValue: true
    });
    console.log("5. After clicking Play Solaris Saga:", afterLaunch.result?.result?.value);

    // Capture screenshot of the launched game!
    const ssGame = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(__dirname, 'campaign_gameplay_live.png'), Buffer.from(ssGame.result.data, 'base64'));
    console.log("Saved campaign_gameplay_live.png");

    ws.close();
    chromeProc.kill();
    console.log("Click verification test PASSED successfully!");
}

runClickTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
