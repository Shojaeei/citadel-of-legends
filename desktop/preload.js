/* Sandboxed preload: exposes only two inert configuration flags to the game.
 * No Node.js or Electron APIs are bridged into the page. */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('CITADEL_PORTAL', 'desktop');
contextBridge.exposeInMainWorld('CITADEL_DISABLE_SW', true);
