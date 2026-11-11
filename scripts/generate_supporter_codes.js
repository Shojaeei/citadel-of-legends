#!/usr/bin/env node
/* ==========================================================================
   Royal Supporter code generator (owner-only tool)
   --------------------------------------------------------------------------
   Generates cryptographically random supporter codes and their SHA-256
   digests. Distribute the CODES to supporters (e.g. itch.io "external keys");
   paste only the HASHES into BUSINESS_CONFIG.supporterCodeHashes in
   js/monetization.js. Never commit the plaintext codes.

   Usage: node scripts/generate_supporter_codes.js [count=50] [--out codes.csv]
   ========================================================================== */
const crypto = require('crypto');
const fs = require('fs');

// Unambiguous alphabet (no 0/O, 1/I/L) - easier to type from an email.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBlock(len = 4) {
    let out = '';
    const bytes = crypto.randomBytes(len * 2);
    for (let i = 0; out.length < len; i++) {
        const b = bytes[i % bytes.length];
        // Rejection sampling avoids modulo bias.
        if (b < 256 - (256 % ALPHABET.length)) out += ALPHABET[b % ALPHABET.length];
        if (i > len * 8) return randomBlock(len);
    }
    return out;
}

function generateCodes(count = 50) {
    const seen = new Set();
    const out = [];
    while (out.length < count) {
        const code = `AVALON-${randomBlock()}-${randomBlock()}-${randomBlock()}`;
        if (seen.has(code)) continue;
        seen.add(code);
        out.push({ code, sha256: crypto.createHash('sha256').update(code).digest('hex') });
    }
    return out;
}

if (require.main === module) {
    const count = Math.max(1, Math.min(10000, parseInt(process.argv[2], 10) || 50));
    const outIdx = process.argv.indexOf('--out');
    const codes = generateCodes(count);
    const csv = 'code,sha256\n' + codes.map(c => `${c.code},${c.sha256}`).join('\n') + '\n';
    if (outIdx > -1) {
        fs.writeFileSync(process.argv[outIdx + 1], csv, { mode: 0o600 });
        console.log(`Wrote ${count} codes to ${process.argv[outIdx + 1]} (keep this file private).`);
    } else {
        process.stdout.write(csv);
    }
    console.error('\nPaste into BUSINESS_CONFIG.supporterCodeHashes:\n' + JSON.stringify(codes.map(c => c.sha256), null, 4));
}

module.exports = { generateCodes };
