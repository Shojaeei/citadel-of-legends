/* Minimal, dependency-free ZIP (PKZIP 2.0, DEFLATE) writer and reader.
 * Writer is used by the release packager; reader is used by the test suite
 * to verify archive contents without shelling out to `unzip`. */
const zlib = require('zlib');

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

// Fixed timestamp => byte-for-byte reproducible builds.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** @param {{name:string, data:Buffer}[]} entries */
function createZip(entries) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const e of entries) {
        const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8');
        const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data);
        const crc = crc32(data);
        const deflated = zlib.deflateRawSync(data, { level: 9 });
        const useDeflate = deflated.length < data.length;
        const body = useDeflate ? deflated : data;
        const method = useDeflate ? 8 : 0;

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6); // UTF-8 names
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        locals.push(local, name, body);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(0x031e, 4); // made by: unix, v3.0
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(DOS_TIME, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(body.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // -rw-r--r--
        central.writeUInt32LE(offset, 42);
        centrals.push(central, name);

        offset += local.length + name.length + body.length;
    }
    const centralBuf = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, centralBuf, end]);
}

/** Returns [{name, data}] - verifies CRCs. */
function readZip(buf) {
    const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error('Not a zip archive');
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out = [];
    for (let i = 0; i < count; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory');
        const method = buf.readUInt16LE(p + 10);
        const crc = buf.readUInt32LE(p + 16);
        const csize = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28);
        const extraLen = buf.readUInt16LE(p + 30);
        const commentLen = buf.readUInt16LE(p + 32);
        const localOff = buf.readUInt32LE(p + 42);
        const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');
        const lNameLen = buf.readUInt16LE(localOff + 26);
        const lExtra = buf.readUInt16LE(localOff + 28);
        const start = localOff + 30 + lNameLen + lExtra;
        const raw = buf.slice(start, start + csize);
        const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
        if (crc32(data) !== crc) throw new Error(`CRC mismatch for ${name}`);
        out.push({ name, data });
        p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
}

module.exports = { createZip, readZip, crc32 };
