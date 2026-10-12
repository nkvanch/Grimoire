'use strict';
// Makes desktop/icon.ico (256x256, PNG-compressed) from the app icon, for the Windows executable.
//   node desktop/scripts/make-ico.js            (run from the repository root; uses pngjs from its node_modules)
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const { PNG } = require(path.join(root, 'node_modules', 'pngjs'));

const SIZE = 256;
const source = PNG.sync.read(fs.readFileSync(path.join(root, 'assets', 'icon.png')));
const out = new PNG({ width: SIZE, height: SIZE });
const scale = source.width / SIZE;   // box filter: average every source pixel that falls in a target pixel
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    const y0 = Math.floor(y * scale), y1 = Math.max(y0 + 1, Math.floor((y + 1) * scale));
    const x0 = Math.floor(x * scale), x1 = Math.max(x0 + 1, Math.floor((x + 1) * scale));
    for (let sy = y0; sy < y1; sy++) {
      for (let sx = x0; sx < x1; sx++) {
        const i = (sy * source.width + sx) * 4;
        const alpha = source.data[i + 3];
        r += source.data[i] * alpha; g += source.data[i + 1] * alpha; b += source.data[i + 2] * alpha; a += alpha; n++;
      }
    }
    const o = (y * SIZE + x) * 4;
    out.data[o] = a ? Math.round(r / a) : 0;
    out.data[o + 1] = a ? Math.round(g / a) : 0;
    out.data[o + 2] = a ? Math.round(b / a) : 0;
    out.data[o + 3] = Math.round(a / n);
  }
}
const png = PNG.sync.write(out);

// ICO: header (reserved, type 1, one image), one directory entry (256 is written as 0), then the PNG bytes.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 0; entry[1] = 0; entry[2] = 0; entry[3] = 0;
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(header.length + entry.length, 12);
fs.writeFileSync(path.join(root, 'desktop', 'icon.ico'), Buffer.concat([header, entry, png]));
console.log('wrote desktop/icon.ico', png.length, 'bytes of PNG');
