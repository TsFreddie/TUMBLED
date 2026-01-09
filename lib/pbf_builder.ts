interface Glyph {
  top: number;
  left: number;
  width: number;
  height: number;
  advance: number;
  data: number[];
}

const compress = (bits: number[]): { units: number; buffer: Buffer } | null => {
  let rleLen = 1 << (4 - 1);
  let units: { bit: 0 | 1; length: number }[] = [];

  let currentUnit: { bit: 0 | 1; length: number } = { bit: 0, length: 0 };
  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i]!;
    if (bit == currentUnit.bit && currentUnit.length < rleLen) {
      currentUnit.length++;
    } else {
      if (currentUnit.length) {
        units.push(currentUnit);
      }
      currentUnit = { bit: bit ? 1 : 0, length: 1 };
    }
  }

  if (currentUnit.length) {
    units.push(currentUnit);
  }

  while (units.length > 0 && units[units.length - 1]!.bit === 0) {
    units.pop();
  }

  const buffer = Buffer.alloc(Math.ceil(units.length / 2));
  for (let i = 0; i < buffer.length; i++) {
    const unitLSB = units[i * 2] ?? { bit: 0, length: 1 };
    const unitMSB = units[i * 2 + 1] ?? { bit: 0, length: 1 };
    buffer[i] =
      (unitMSB.bit << 7) |
      ((unitMSB.length - 1) << 4) |
      (unitLSB.bit << 3) |
      (unitLSB.length - 1);
  }

  if (units.length > 255) {
    return null;
  }

  return {
    units: units.length,
    buffer,
  };
};

export class Writer {
  #length: number = 0;
  #capacity: number;
  #buffer: Buffer;

  constructor(capacity: number = 128) {
    this.#capacity = capacity;
    this.#buffer = Buffer.alloc(capacity);
  }

  #grow(target: number) {
    while (this.#capacity < target) {
      this.#capacity *= 2;
    }
    const newBuffer = Buffer.alloc(this.#capacity);
    this.#buffer.copy(newBuffer);
    this.#buffer = newBuffer;
  }

  get length() {
    return this.#length;
  }

  writeUint8(value: number): void {
    const target = this.#length + 1;
    if (target > this.#capacity) {
      this.#grow(target);
    }
    this.#buffer.writeUint8(value, this.#length);
    this.#length += 1;
  }

  writeInt8(value: number): void {
    const target = this.#length + 1;
    if (target > this.#capacity) {
      this.#grow(target);
    }
    this.#buffer.writeInt8(value, this.#length);
    this.#length += 1;
  }

  writeUint16LE(value: number): void {
    const target = this.#length + 2;
    if (target > this.#capacity) {
      this.#grow(target);
    }
    this.#buffer.writeUint16LE(value, this.#length);
    this.#length += 2;
  }

  writeUint32LE(value: number): void {
    const target = this.#length + 4;
    if (target > this.#capacity) {
      this.#grow(target);
    }
    this.#buffer.writeUint32LE(value, this.#length);
    this.#length += 4;
  }

  concat(buffer: Buffer): void {
    const target = this.#length + buffer.length;
    if (target > this.#capacity) {
      this.#grow(target);
    }
    buffer.copy(this.#buffer, this.#length);
    this.#length += buffer.length;
  }

  toBuffer(): Buffer {
    return this.#buffer.subarray(0, this.#length);
  }
}

const hasher = (codepoint: number) => {
  return codepoint % 255;
};

export class PBFBuilder {
  private glyphs: Record<number, Glyph> = {};

  constructor(
    private fontHeight: number,
    private wildcardCodepoint: number = 9647,
  ) {}

  public addGlyph(codepoint: number, glyph: Glyph) {
    this.glyphs[codepoint] = glyph;
  }

  private buildTables(compressed: boolean) {
    let codePointByteWidth = 2;
    let offsetByteWidth = 2;
    let glyphCount = 0;

    const hashTable: {
      hash: number;
      offsetTableSize: number;
      offset: number;
    }[] = new Array(255);

    // initialize hashTable
    for (let i = 0; i < 255; i++) {
      hashTable[i] = {
        hash: i,
        offsetTableSize: 0,
        offset: 0,
      };
    }

    // initialize offsetTables
    const offsetTables: { codepoint: number; offset: number }[][] = new Array(
      255,
    );
    for (let i = 0; i < 255; i++) {
      offsetTables[i] = [];
    }

    const glyphTable = new Writer();

    if (this.glyphs[this.wildcardCodepoint] == undefined) {
      throw new Error("Wildcard glyph not found");
    }

    // get glyph list and shift wildcard to the front
    const glyphs = Object.entries(this.glyphs)
      .map(([codepoint, glyph]) => ({
        codepoint: parseInt(codepoint),
        glyph,
      }))
      .filter((g) => g.codepoint !== this.wildcardCodepoint);

    glyphs.unshift({
      codepoint: this.wildcardCodepoint,
      glyph: this.glyphs[this.wildcardCodepoint]!,
    });

    const ignoredGlyphs: typeof glyphs = [];

    for (const g of glyphs) {
      const hash = hasher(g.codepoint);
      const offsetTable = offsetTables[hash]!;
      if (offsetTable.length > 255) {
        ignoredGlyphs.push(g);
        continue;
      }

      if (compressed) {
        const compressedGlyph = compress(g.glyph.data);
        if (compressedGlyph == null) {
          ignoredGlyphs.push(g);
          continue;
        }

        offsetTable.push({
          codepoint: g.codepoint,
          offset: glyphTable.length,
        });
        glyphCount++;

        if (glyphTable.length > 65535) {
          offsetByteWidth = 4;
        }

        glyphTable.writeUint8(g.glyph.width);
        glyphTable.writeUint8(compressedGlyph.units);
        glyphTable.writeInt8(g.glyph.left);
        glyphTable.writeInt8(g.glyph.top);
        glyphTable.writeInt8(g.glyph.advance);
        glyphTable.concat(compressedGlyph.buffer);
      } else {
        offsetTable.push({
          codepoint: g.codepoint,
          offset: glyphTable.length,
        });
        glyphCount++;

        if (glyphTable.length > 65535) {
          offsetByteWidth = 4;
        }

        const dataBytes = Math.ceil((g.glyph.width * g.glyph.height) / 8);

        glyphTable.writeUint8(g.glyph.width);
        glyphTable.writeUint8(g.glyph.height);
        glyphTable.writeInt8(g.glyph.left);
        glyphTable.writeInt8(g.glyph.top);
        glyphTable.writeInt8(g.glyph.advance);

        const dataBuffer = Buffer.alloc(dataBytes);
        for (let i = 0; i < g.glyph.data.length; i++) {
          const bitMask = 1 << (i % 8);
          const bytePosition = Math.floor(i / 8);
          let byte = dataBuffer[bytePosition]!;
          byte |= g.glyph.data[i] ? bitMask : 0;
          dataBuffer[bytePosition] = byte;
        }
        glyphTable.concat(dataBuffer);
      }

      if (g.codepoint > 65535) {
        codePointByteWidth = 4;
      }
    }

    // build offset table
    const offsetTableBuffer = new Writer();
    for (let i = 0; i < 255; i++) {
      const offsetTable = offsetTables[i]!;
      hashTable[i]!.offsetTableSize = offsetTable.length;
      hashTable[i]!.offset = offsetTableBuffer.length;

      for (const entry of offsetTable) {
        if (codePointByteWidth == 4) {
          offsetTableBuffer.writeUint32LE(entry.codepoint);
        } else {
          offsetTableBuffer.writeUint16LE(entry.codepoint);
        }

        if (offsetByteWidth == 4) {
          offsetTableBuffer.writeUint32LE(entry.offset);
        } else {
          offsetTableBuffer.writeUint16LE(entry.offset);
        }
      }
    }

    // build hash table
    const hashTableBuffer = new Writer();
    for (const entry of hashTable) {
      hashTableBuffer.writeUint8(entry.hash);
      hashTableBuffer.writeUint8(entry.offsetTableSize);
      hashTableBuffer.writeUint16LE(entry.offset);
    }

    return {
      ignoredGlyphs,
      codePointByteWidth,
      offsetByteWidth,
      glyphCount,
      hashTable: hashTableBuffer.toBuffer(),
      offsetTable: offsetTableBuffer.toBuffer(),
      glyphTable: glyphTable.toBuffer(),
    };
  }

  public build(force: "compressed" | "uncompressed" | "" = "") {
    let result;
    let compressed = false;

    if (force === "compressed") {
      result = this.buildTables(true);
      compressed = true;
    } else if (force === "uncompressed") {
      result = this.buildTables(false);
      compressed = false;
    } else {
      const uncompressedData = this.buildTables(false);
      const compressedData = this.buildTables(true);
      compressed =
        compressedData.glyphTable.length < uncompressedData.glyphTable.length;
      result = compressed ? compressedData : uncompressedData;
    }

    // Build Header
    const header = new Writer();
    header.writeUint8(3); // version
    header.writeUint8(this.fontHeight); // max height
    header.writeUint16LE(result.glyphCount); // number of glyphs
    header.writeUint16LE(this.wildcardCodepoint); // wildcard codepoint
    header.writeUint8(255); // hash table size
    header.writeUint8(result.codePointByteWidth); // codepoint byte width
    header.writeUint8(10); // header size

    let features = 0;
    if (result.offsetByteWidth === 2) {
      features |= 0x01;
    }
    if (compressed) {
      features |= 0x02;
    }
    header.writeUint8(features); // features

    const buffer = Buffer.concat([
      header.toBuffer(),
      result.hashTable,
      result.offsetTable,
      result.glyphTable,
    ]);

    return {
      ignoredGlyphs: result.ignoredGlyphs,
      compressed,
      buffer,
    };
  }
}
