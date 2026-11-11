const { spawn } = require('child_process');
const http = require('http');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetUrl = 'file:///d:/Citadel%20of%20Legends/index.html';
const port = 9224;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function debug() {
    const chromeProc = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--window-size=1280,720',
        '--disable-gpu',
        '--no-sandbox',
        targetUrl
    ]);

    await sleep(2000);
    const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
    const pageTarget = targets.find(t => t.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    function send(method, params = {}) {
        return new Promise((resolve) => {
            const reqId = id++;
            const handler = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id === reqId) {
                    ws.removeEventListener('message', handler);
                    resolve(msg);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');

    const res1 = await send('Runtime.evaluate', {
        expression: `(function() {
            const buttons = Array.from(document.querySelectorAll('#main-menu button')).map(b => ({
                text: b.innerText,
                onclick: b.getAttribute('onclick')
            }));
            
            const modalBefore = {
                classes: document.getElementById('campaign-modal').className,
                style: window.getComputedStyle(document.getElementById('campaign-modal')).display
            };

            // Directly call GameApp.showCampaignSelect()
            GameApp.showCampaignSelect();

            const modalAfter = {
                classes: document.getElementById('campaign-modal').className,
                style: window.getComputedStyle(document.getElementById('campaign-modal')).display
            };

            return JSON.stringify({ buttons, modalBefore, modalAfter });
        })()`,
        returnByValue: true
    });

    console.log("Evaluation Result:", res1.result.result.value);
    ws.close();
    chromeProc.kill();
}

debug();
