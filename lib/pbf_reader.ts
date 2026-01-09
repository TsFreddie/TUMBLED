const decompress = (buffer: number[], units: number, width: number) => {
  let string = "";
  for (let i = 0; i < units; i++) {
    const byte = Math.floor(i / 2);
    const nibble = i % 2;
    const value = !nibble ? buffer[byte]! & 0x0f : buffer[byte]! >> 4;
    const length = value & 0x07;
    const bit = value >> 3;
    string += (bit ? "#" : " ").repeat(length + 1);
  }

  const lines: string[] = [];
  while (string.length > 0) {
    lines.push(string.slice(0, width));
    string = string.slice(width);
  }

  return lines;
};

export const readPbf = (buffer: Buffer) => {
  const version = buffer.readUint8(0);
  const maxHeight = buffer.readUInt8(1);
  const numberOfGlyphs = buffer.readUint16LE(2);
  const wildcardCodepoint = buffer.readUint16LE(4);
  const hashTableSize = buffer.readUint8(6);
  const codePointByteWidth = buffer.readUint8(7);
  const headerSize = buffer.readUint8(8);
  const features = buffer.readUint8(9);

  const tableOffestUInt16 = features & 0x01;
  const offsetByteWidth = tableOffestUInt16 ? 2 : 4;
  const compressed = !!(features & 0x02);

  const offsetTableEntrySize = codePointByteWidth + offsetByteWidth;

  const hashTable: {
    hash: number;
    offsetTableSize: number;
    offset: number;
  }[] = [];

  const hashTableByteWidth = 4;
  const startOfOffsetTable = headerSize + hashTableSize * hashTableByteWidth;
  const startOfGlyphTable =
    startOfOffsetTable + offsetTableEntrySize * numberOfGlyphs;

  for (let i = 0; i < hashTableSize; i++) {
    const entry = {
      hash: buffer.readInt8(headerSize + i * hashTableByteWidth),
      offsetTableSize: buffer.readInt8(headerSize + i * hashTableByteWidth + 1),
      offset: buffer.readUint16LE(headerSize + i * hashTableByteWidth + 2),
    };

    hashTable.push(entry);
  }

  const offsetTables: Record<number, number> = {};

  for (const entry of hashTable) {
    const tableOffset = startOfOffsetTable + entry.offset;
    for (let i = 0; i < entry.offsetTableSize; i++) {
      const offsetOffset = tableOffset + i * offsetTableEntrySize;
      const codepoint = buffer.readUintLE(offsetOffset, codePointByteWidth);
      const glyphOffset = buffer.readUintLE(
        offsetOffset + codePointByteWidth,
        offsetByteWidth,
      );
      offsetTables[codepoint] = glyphOffset;
    }
  }

  const read = (target: number) => {
    const glyphOffset = offsetTables[target];

    if (glyphOffset == undefined) {
      throw new Error(`Glyph ${target} not found`);
    }

    const offset = startOfGlyphTable + glyphOffset;

    const glyph = {
      width: buffer.readUint8(offset + 0),
      height: buffer.readUint8(offset + 1),
      left: buffer.readInt8(offset + 2),
      top: buffer.readInt8(offset + 3),
      advance: buffer.readInt8(offset + 4),
    };

    // print glyph
    const lines: string[] = [];
    const dataOffset = offset + 5;

    if (!compressed) {
      // read uncompressed pixels
      const numPixels = glyph.width * glyph.height;
      let currentBit = 0;
      let currentByte = 0;

      const pixels: string[] = [];

      for (let pixel = 0; pixel < numPixels; pixel++) {
        // Read the byte containing the current pixel's bit
        const byte = buffer.readUint8(dataOffset + currentByte);

        // Extract the bit at the current bit position (0 = least significant bit)
        const bitValue = (byte >> currentBit) & 1;

        // Store "#" for 1, " " for 0
        pixels.push(bitValue === 1 ? "#" : " ");

        // Move to the next bit
        currentBit++;

        // If we've processed all 8 bits in the current byte, move to the next byte
        if (currentBit === 8) {
          currentBit = 0;
          currentByte++;
        }
      }

      for (let i = 0; i < glyph.height; i++) {
        let line = "";
        for (let j = 0; j < glyph.width; j++) {
          line += pixels[i * glyph.width + j];
        }
        lines.push(line);
      }
    } else {
      // read compressed pixels
      const bytes: number[] = [];

      for (let i = 0; i < glyph.height / 2; i++) {
        const byte = buffer.readUint8(dataOffset + i);
        bytes.push(byte);
      }

      lines.push(...decompress(bytes, glyph.height, glyph.width));

      glyph.height = lines.length;
    }

    return {
      ...glyph,
      data: lines.join("\n"),
    };
  };

  return {
    version,
    maxHeight,
    numberOfGlyphs,
    wildcardCodepoint,
    hashTableSize,
    codePointBytes: codePointByteWidth,
    headerSize,
    features: {
      offsetByteWidth,
      compressed,
    },
    hashTable,
    offsetTables,
    offsets: {
      offsetTable: startOfOffsetTable,
      glyphTable: startOfGlyphTable,
    },
    read,
  };
};
