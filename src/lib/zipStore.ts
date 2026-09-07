/**
 * 零依赖 ZIP 打包（store 模式，不压缩）：
 * 统计导出等小文件用，合法 zip 格式，Windows/macOS 解压工具直接打开。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i])!]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
}

export class ZipBuilder {
  private chunks: Uint8Array[] = [];
  private entries: ZipEntry[] = [];
  private offset = 0;

  private push(bytes: Uint8Array) {
    this.chunks.push(bytes);
    this.offset += bytes.length;
  }

  add(name: string, content: string | Uint8Array): this {
    const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(header.buffer);
    dv.setUint32(0, 0x04034b50, true); // local file header signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0x0800, true); // UTF-8 文件名
    dv.setUint16(8, 0, true); // store（不压缩）
    dv.setUint16(10, 0, true); // time
    dv.setUint16(12, 0x21, true); // date（1980-02-01，占位）
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true); // compressed size
    dv.setUint32(22, data.length, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra length
    header.set(nameBytes, 30);

    this.entries.push({ name, data, crc, offset: this.offset });
    this.push(header);
    this.push(data);
    return this;
  }

  build(): Uint8Array {
    // 中央目录
    const central: Uint8Array[] = [];
    let centralSize = 0;
    for (const e of this.entries) {
      const nameBytes = new TextEncoder().encode(e.name);
      const rec = new Uint8Array(46 + nameBytes.length);
      const dv = new DataView(rec.buffer);
      dv.setUint32(0, 0x02014b50, true); // central directory signature
      dv.setUint16(4, 20, true); // version made by
      dv.setUint16(6, 20, true); // version needed
      dv.setUint16(8, 0x0800, true); // UTF-8
      dv.setUint16(10, 0, true); // store
      dv.setUint16(12, 0, true);
      dv.setUint16(14, 0x21, true);
      dv.setUint32(16, e.crc, true);
      dv.setUint32(20, e.data.length, true);
      dv.setUint32(24, e.data.length, true);
      dv.setUint16(28, nameBytes.length, true);
      dv.setUint16(30, 0, true); // extra
      dv.setUint16(32, 0, true); // comment
      dv.setUint16(34, 0, true); // disk number
      dv.setUint16(36, 0, true); // internal attrs
      dv.setUint32(38, 0, true); // external attrs
      dv.setUint32(42, e.offset, true); // local header offset
      rec.set(nameBytes, 46);
      central.push(rec);
      centralSize += rec.length;
    }
    const eocd = new Uint8Array(22);
    const dv = new DataView(eocd.buffer);
    dv.setUint32(0, 0x06054b50, true);
    dv.setUint16(8, this.entries.length, true);
    dv.setUint16(10, this.entries.length, true);
    dv.setUint32(12, centralSize, true);
    dv.setUint32(16, this.offset, true); // central directory offset

    const total = this.offset + centralSize + 22;
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of [...this.chunks, ...central, eocd]) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }
}
