/* ==========================================================================
   Citadel of Legends: Shattered Realms - In-Game Developer Console & Chat
   ========================================================================== */

class DevConsole {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.messages = [];
        this.commandHistory = [];
        this.historyIndex = -1;

        this.initUI();
        this.setupListeners();

        this.log("Citadel Developer Console & Chat initialized. Press [~] or click 'Dev Chat' to toggle. Type /help for commands.", 'SYSTEM');
    }

    initUI() {
        // Create modal element if not in DOM
        let el = document.getElementById('dev-console-modal');
        if (!el) {
            el = document.createElement('div');
            el.id = 'dev-console-modal';
            el.className = 'fixed top-12 right-4 w-96 max-w-[90vw] h-80 z-50 parchment-panel rounded-lg flex flex-col shadow-2xl border-2 border-amber-600 hidden font-mono text-xs';
            el.innerHTML = `
                <div class="flex items-center justify-between bg-stone-900/90 px-3 py-1.5 border-b border-stone-700 select-none">
                    <div class="flex items-center space-x-2">
                        <span class="text-amber-400 font-bold">&#128220; Citadel Dev Chat & Console</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-[10px] text-stone-400">[~] to toggle</span>
                        <button onclick="GameApp.devConsole.toggle()" class="text-stone-400 hover:text-white font-bold px-1">&times;</button>
                    </div>
                </div>
                <div id="dev-console-output" class="flex-1 p-2.5 overflow-y-auto space-y-1 bg-stone-950/80 font-mono text-[11px] select-text"></div>
                <div class="p-2 bg-stone-900 border-t border-stone-800 flex items-center space-x-2">
                    <span class="text-amber-500 font-bold">&gt;</span>
                    <input id="dev-console-input" type="text" placeholder="Type a chat message or /command..." class="flex-1 bg-stone-950 border border-stone-700 rounded px-2 py-1 text-stone-200 outline-none focus:border-amber-500 font-mono text-xs">
                    <button onclick="GameApp.devConsole.submitInput()" class="parchment-button px-2.5 py-1 rounded text-[11px] font-bold">Send</button>
                </div>
            `;
            document.body.appendChild(el);
        }
        this.dom = el;
        this.outputEl = document.getElementById('dev-console-output');
        this.inputEl = document.getElementById('dev-console-input');
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' || e.key === '~') {
                e.preventDefault();
                this.toggle();
            } else if (this.isOpen && e.key === 'Escape') {
                this.toggle(false);
            }
        });

        if (this.inputEl) {
            this.inputEl.addEventListener('keydown', (e) => {
                // Prevent game shortcuts while typing in console
                e.stopPropagation();

                if (e.key === 'Enter') {
                    this.submitInput();
                } else if (e.key === 'ArrowUp') {
                    if (this.commandHistory.length > 0 && this.historyIndex < this.commandHistory.length - 1) {
                        this.historyIndex++;
                        this.inputEl.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
                    }
                } else if (e.key === 'ArrowDown') {
                    if (this.historyIndex > 0) {
                        this.historyIndex--;
                        this.inputEl.value = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
                    } else if (this.historyIndex === 0) {
                        this.historyIndex = -1;
                        this.inputEl.value = '';
                    }
                }
            });
        }
    }

    toggle(forceState) {
        this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
        if (this.dom) {
            this.dom.classList.toggle('hidden', !this.isOpen);
            if (this.isOpen && this.inputEl) {
                setTimeout(() => this.inputEl.focus(), 50);
            }
        }
    }

    log(text, tag = 'CHAT', color = null) {
        const time = new Date().toLocaleTimeString();
        const msg = { text, tag, time, color };
        this.messages.push(msg);

        if (this.outputEl) {
            const div = document.createElement('div');
            let tagColor = 'text-stone-400';
            if (tag === 'SYSTEM') tagColor = 'text-cyan-400';
            else if (tag === 'HERALD') tagColor = 'text-amber-400 font-bold';
            else if (tag === 'AI LORD') tagColor = 'text-red-400 font-bold';
            else if (tag === 'CHEAT') tagColor = 'text-purple-400 font-semibold';
            else if (tag === 'WARN') tagColor = 'text-orange-400';

            const textColor = color || (tag === 'SYSTEM' ? 'text-stone-300' : 'text-stone-200');

            div.innerHTML = `<span class="text-stone-500 text-[10px]">[${time}]</span> <span class="${tagColor}">[${tag}]</span> <span class="${textColor}">${this.escapeHtml(text)}</span>`;
            this.outputEl.appendChild(div);
            this.outputEl.scrollTop = this.outputEl.scrollHeight;
        }
    }

    submitInput() {
        if (!this.inputEl) return;
        const text = this.inputEl.value.trim();
        if (!text) return;

        this.inputEl.value = '';
        this.commandHistory.push(text);
        this.historyIndex = -1;

        if (text.startsWith('/')) {
            this.executeCommand(text);
        } else {
            // General player dev chat message
            this.log(text, 'LORD');
        }
    }

    executeCommand(cmdStr) {
        const parts = cmdStr.slice(1).split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (cmd) {
            case 'help':
                this.log("=== Citadel Developer Commands ===", 'SYSTEM');
                this.log("/gold <amt> - Add gold sovereigns", 'SYSTEM');
                this.log("/wood <amt> - Add ironwood timber", 'SYSTEM');
                this.log("/stone <amt> - Add basalt blocks", 'SYSTEM');
                this.log("/iron <amt> - Add mythril iron ore", 'SYSTEM');
                this.log("/res <all|type> <amt> - Add resources", 'SYSTEM');
                this.log("/spawn <unitType> [count] [enemy] - Spawn units", 'SYSTEM');
                this.log("/wave - Immediately trigger enemy siege attack", 'SYSTEM');
                this.log("/speed <1|2|4> - Set simulation speed multiplier", 'SYSTEM');
                this.log("/killall - Slay all enemy combatants", 'SYSTEM');
                this.log("/god - Maximize all resources", 'SYSTEM');
                this.log("/win - Instantly win current mission", 'SYSTEM');
                this.log("/fog - Toggle fog of war", 'SYSTEM');
                this.log("/save [1-3] | /load [1-3|auto] - Save slots", 'SYSTEM');
                this.log("/stress <n> - Spawn n skirmishing units (perf test)", 'SYSTEM');
                this.log("/fps - Show frame rate & entity counts", 'SYSTEM');
                this.log("/objectives - Print mission objective status", 'SYSTEM');
                this.log("/clear - Clear console screen", 'SYSTEM');
                break;

            case 'gold':
            case 'wood':
            case 'stone':
            case 'iron':
            case 'pitch':
            case 'food':
            case 'honor': {
                const amt = parseInt(args[0]) || 200;
                if (this.game.economy.res[cmd] !== undefined) {
                    this.game.economy.res[cmd] += amt;
                    this.game.updateUI();
                    this.log(`Granted +${amt} ${cmd.toUpperCase()}`, 'CHEAT');
                    Sound.playCoin();
                }
                break;
            }

            case 'res': {
                const type = args[0] || 'all';
                const amt = parseInt(args[1]) || 200;
                if (type === 'all') {
                    ['wood', 'stone', 'iron', 'pitch', 'gold', 'honor', 'food'].forEach(r => {
                        this.game.economy.res[r] += amt;
                    });
                    this.game.updateUI();
                    this.log(`Granted +${amt} to ALL resources`, 'CHEAT');
                    Sound.playCoin();
                } else if (this.game.economy.res[type] !== undefined) {
                    this.game.economy.res[type] += amt;
                    this.game.updateUI();
                    this.log(`Granted +${amt} ${type.toUpperCase()}`, 'CHEAT');
                }
                break;
            }

            case 'god':
                ['wood', 'stone', 'iron', 'pitch', 'gold', 'honor', 'food'].forEach(r => {
                    this.game.economy.res[r] += 9999;
                });
                this.game.economy.popularity = 100;
                this.game.updateUI();
                this.log("GODMODE: +9999 all resources, 100% Popularity!", 'CHEAT');
                Sound.playCheer();
                break;

            case 'spawn': {
                const unitType = args[0] || 'knight';
                const count = parseInt(args[1]) || 1;
                const isEnemy = args[2] === 'enemy' || args[2] === 'hostile';

                if (!UNITS_DEF[unitType]) {
                    this.log(`Unknown unit type: '${unitType}'. Valid: ${Object.keys(UNITS_DEF).join(', ')}`, 'WARN');
                    return;
                }

                const count2 = Math.max(1, Math.min(200, count));
                const keep = this.game.buildings.find(b => b.type === 'keep' && b.isEnemy === isEnemy);
                const spawnX = keep ? keep.gx + 1.5 : 25;
                const spawnY = keep ? keep.gy + 1.5 : 25;

                for (let i = 0; i < count2; i++) {
                    const unit = new Unit(unitType, spawnX + (Math.random() * 2 - 1), spawnY + 3.5 + Math.random(), isEnemy, isEnemy ? this.game.enemyFaction() : this.game.faction);
                    this.game.units.push(unit);
                }

                this.log(`Spawned ${count2}x ${unitType} (${isEnemy ? 'Enemy' : 'Friendly'})`, 'CHEAT');
                Sound.playSwordClash();
                break;
            }

            case 'wave':
                this.log("Triggering enemy siege wave immediately!", 'AI LORD');
                this.game.triggerEnemyWave();
                break;

            case 'killall': {
                let killed = 0;
                for (let i = this.game.units.length - 1; i >= 0; i--) {
                    if (this.game.units[i].isEnemy) {
                        this.game.units.splice(i, 1);
                        killed++;
                    }
                }
                this.log(`Slew ${killed} enemy units!`, 'CHEAT');
                Sound.playSwordClash();
                break;
            }

            case 'speed': {
                const factor = parseFloat(args[0]);
                const speed = Number.isFinite(factor) ? Math.max(0, Math.min(5.0, factor)) : 1;
                if (GAME_SPEEDS.includes(speed)) this.game.setSpeed(speed);
                else this.game.simSpeed = speed;
                this.log(`Game simulation speed set to ${this.game.simSpeed}x`, 'SYSTEM');
                break;
            }

            case 'fog':
                this.game.fog.enabled = !this.game.fog.enabled;
                if (this.game.minimap) this.game.minimap.markTerrainDirty();
                this.log(`Fog of war ${this.game.fog.enabled ? 'ENABLED' : 'DISABLED'}`, 'CHEAT');
                break;

            case 'save': {
                const slot = `slot${['1', '2', '3'].includes(args[0]) ? args[0] : '1'}`;
                this.game.saveToSlot(slot);
                this.log(`Saved to ${slot}`, 'SYSTEM');
                break;
            }

            case 'load': {
                const slot = args[0] === 'auto' ? 'auto' : `slot${['1', '2', '3'].includes(args[0]) ? args[0] : '1'}`;
                const ok = this.game.loadFromSlot(slot);
                this.log(ok ? `Loaded ${slot}` : `Could not load ${slot}`, ok ? 'SYSTEM' : 'WARN');
                break;
            }

            case 'stress': {
                const n = Math.max(2, Math.min(400, parseInt(args[0], 10) || 250));
                for (let i = 0; i < n; i++) {
                    const enemy = i % 2 === 1;
                    const u = new Unit(enemy ? 'halberdier' : 'knight', enemy ? 36 + Math.random() * 6 : 24 + Math.random() * 4, 22 + Math.random() * 18, enemy, enemy ? this.game.enemyFaction() : this.game.faction);
                    this.game.units.push(u);
                }
                this.log(`Stress test: spawned ${n} units. Use /fps to monitor.`, 'CHEAT');
                break;
            }

            case 'fps':
                this.log(`FPS ~${Math.round(this.game._fps)} | units ${this.game.units.length} | buildings ${this.game.buildings.length} | projectiles ${this.game.projectiles.length} | fx ${this.game.fx.totalParticles}`, 'SYSTEM');
                break;

            case 'objectives': {
                const st = this.game.campaign.getObjectiveStatuses();
                if (st.length === 0) this.log('No campaign mission active (skirmish).', 'SYSTEM');
                st.forEach(o => this.log(`${o.done ? '[x]' : '[ ]'} ${o.obj.label} (${o.current}/${o.target})`, 'SYSTEM'));
                const b = this.game.campaign.evaluateBonus();
                if (this.game.currentMissionData && this.game.currentMissionData.bonus) this.log(`Bonus: ${this.game.currentMissionData.bonus.label} - ${b.text}`, 'SYSTEM');
                break;
            }

            case 'win':
                this.log("Cheat victory triggered!", 'CHEAT');
                if (this.game.currentMissionData) this.game.completeMission();
                else this.game.triggerVictory();
                break;

            case 'lose':
                this.log("Cheat defeat triggered!", 'CHEAT');
                this.game.triggerDefeat();
                break;

            case 'clear':
                if (this.outputEl) this.outputEl.innerHTML = '';
                this.messages = [];
                break;

            default:
                this.log(`Unknown command: /${cmd}. Type /help for available commands.`, 'WARN');
                break;
        }
    }

    escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.DevConsole = DevConsole;
}
