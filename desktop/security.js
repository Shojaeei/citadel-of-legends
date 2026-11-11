/* Security helpers for the desktop shell, kept free of Electron imports so
 * they can be unit-tested in plain Node (tests/test_runner.js). */
const path = require('path');

/** Content-Security-Policy applied to every response from app://. 'unsafe-inline'
 *  is required for the game's inline onclick handlers; no remote origins are allowed. */
const CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'"
].join('; ');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.md': 'text/plain; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.gif': 'image/gif'
};

/**
 * Map an app:// request URL to an absolute file path inside rootDir.
 * Returns null for anything that escapes rootDir (path traversal) or is malformed.
 */
function resolveAppPath(requestUrl, rootDir) {
    let url;
    try {
        url = new URL(requestUrl);
    } catch (e) {
        return null;
    }
    if (url.protocol !== 'app:') return null;
    let rel;
    try {
        rel = decodeURIComponent(url.pathname);
    } catch (e) {
        return null;
    }
    if (rel.includes('\0')) return null;
    rel = rel.replace(/^\/+/, '') || 'index.html';
    const root = path.resolve(rootDir);
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) return null;
    return abs;
}

/** Only https links (and mailto) may be handed to the OS browser. */
function isSafeExternalUrl(raw) {
    try {
        const u = new URL(raw);
        return u.protocol === 'https:' || u.protocol === 'mailto:';
    } catch (e) {
        return false;
    }
}

function mimeFor(file) {
    return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

module.exports = { CSP, resolveAppPath, isSafeExternalUrl, mimeFor };
