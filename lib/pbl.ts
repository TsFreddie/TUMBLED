const CRC_POLY = 0x04c11db7n;

function precomputeTable(bits: number): bigint[] {
  const lookupTable: bigint[] = [];
  for (let i = 0; i < 1 << bits; i++) {
    let rr = BigInt(i) << BigInt(32 - bits);
    for (let x = 0; x < bits; x++) {
      if (rr & 0x80000000n) {
        rr = (rr << 1n) ^ CRC_POLY;
      } else {
        rr <<= 1n;
      }
    }
    lookupTable.push(rr & 0xffffffffn);
  }
  return lookupTable;
}

const lookupTable = precomputeTable(8);

function processWord(data: Uint8Array, crc: bigint = 0xffffffffn): bigint {
  if (data.length < 4) {
    const padded = new Uint8Array(4);
    for (let i = 0; i < data.length; i++) {
      padded[i] = data[data.length - 1 - i]!;
    }
    data = padded;
  }

  for (let i = data.length - 1; i >= 0; i--) {
    crc =
      ((crc << 8n) ^ lookupTable[Number((crc >> 24n) ^ BigInt(data[i]!))]!) &
      0xffffffffn;
  }
  return crc;
}

function processBuffer(buf: Uint8Array, c: bigint = 0xffffffffn): bigint {
  const wordCount = Math.floor((buf.length + 3) / 4);

  let crc = c;
  for (let i = 0; i < wordCount; i++) {
    const start = i * 4;
    const end = Math.min(start + 4, buf.length);
    const word = buf.slice(start, end);
    crc = processWord(word, crc);
  }
  return crc;
}

function crc32(data: Uint8Array): number {
  return Number(processBuffer(data) & 0xffffffffn);
}

export class ResourcePackTableEntry {
  contentIndex: number;
  offset: number;
  length: number;
  crc: number;

  constructor(
    contentIndex: number,
    offset: number,
    length: number,
    crc: number,
  ) {
    this.contentIndex = contentIndex;
    this.offset = offset;
    this.length = length;
    this.crc = crc;
  }

  serialize(fileId: number): Uint8Array {
    const buffer = new ArrayBuffer(16);
    const view = new DataView(buffer);
    view.setUint32(0, fileId, true);
    view.setUint32(4, this.offset, true);
    view.setUint32(8, this.length, true);
    view.setUint32(12, this.crc, true);
    return new Uint8Array(buffer);
  }

  static deserialize(
    tableEntryData: Uint8Array,
  ): [number, ResourcePackTableEntry] {
    if (tableEntryData.length !== 16) {
      throw new Error("Invalid table entry data length");
    }
    const view = new DataView(tableEntryData.buffer, tableEntryData.byteOffset);
    const fileId = view.getUint32(0, true);
    const offset = view.getUint32(4, true);
    const length = view.getUint32(8, true);
    const crc = view.getUint32(12, true);

    const entry = new ResourcePackTableEntry(-1, offset, length, crc);
    return [fileId, entry];
  }

  toString(): string {
    return JSON.stringify(this);
  }
}

export class ResourcePack {
  static readonly TABLE_ENTRY_SIZE_BYTES = 16;
  static readonly MANIFEST_SIZE_BYTES = 12;

  tableSize: number;
  contentStart: number;
  timestamp: number;
  crc: number;
  contents: Uint8Array[];
  tableEntries: ResourcePackTableEntry[];
  finalized: boolean;
  numFiles?: number;

  constructor(isSystem: boolean) {
    this.tableSize = isSystem ? 512 : 256;
    this.contentStart =
      ResourcePack.MANIFEST_SIZE_BYTES +
      this.tableSize * ResourcePack.TABLE_ENTRY_SIZE_BYTES;
    this.timestamp = 0;

    this.crc = 0;

    this.contents = [];
    this.tableEntries = [];
    this.finalized = false;
  }

  getContentCrc(): number {
    const allContents = this.serializeContent();
    return crc32(allContents);
  }

  serializeManifest(crc?: number, timestamp?: number): Uint8Array {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setUint32(0, this.tableEntries.length, true);
    view.setUint32(4, crc ?? this.crc, true);
    view.setUint32(8, timestamp ?? this.timestamp, true);
    return new Uint8Array(buffer);
  }

  serializeTable(): Uint8Array {
    // Serialize these entries into table_data
    let curFileId = 1;
    let tableData = new Uint8Array(0);
    for (let i = 0; i < this.tableEntries.length; i++) {
      const tableEntry = this.tableEntries[i]!;
      const entryData = tableEntry.serialize(curFileId++);
      const newTableData = new Uint8Array(tableData.length + entryData.length);
      newTableData.set(tableData);
      newTableData.set(entryData, tableData.length);
      tableData = newTableData;
    }

    // Pad the rest of the table_data up to table_size
    for (let i = curFileId; i <= this.tableSize; i++) {
      const padding = new ResourcePackTableEntry(0, 0, 0, 0).serialize(0);
      const newTableData = new Uint8Array(tableData.length + padding.length);
      newTableData.set(tableData);
      newTableData.set(padding, tableData.length);
      tableData = newTableData;
    }

    return tableData;
  }

  serializeContent(): Uint8Array {
    const serializedContentIndexes = new Set<number>();
    const serializedContent: Uint8Array[] = [];
    const sortedEntries = [...this.tableEntries].sort(
      (a, b) => a.offset - b.offset,
    );
    for (const entry of sortedEntries) {
      if (serializedContentIndexes.has(entry.contentIndex)) {
        continue;
      }

      serializedContentIndexes.add(entry.contentIndex);

      serializedContent.push(this.contents[entry.contentIndex]!);
    }

    const totalLength = serializedContent.reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const content of serializedContent) {
      result.set(content, offset);
      offset += content.length;
    }
    return result;
  }

  static deserialize(
    data: Uint8Array,
    isSystem: boolean = false,
  ): ResourcePack {
    const resourcePack = new ResourcePack(isSystem);

    if (data.length < ResourcePack.MANIFEST_SIZE_BYTES) {
      throw new Error("Data too short for manifest");
    }
    const manifestView = new DataView(data.buffer, data.byteOffset);
    const numFiles = manifestView.getUint32(0, true);
    const crc = manifestView.getUint32(4, true);
    const timestamp = manifestView.getUint32(8, true);
    resourcePack.numFiles = numFiles;
    resourcePack.crc = crc;
    resourcePack.timestamp = timestamp;

    let offset = ResourcePack.MANIFEST_SIZE_BYTES;

    resourcePack.tableEntries = [];
    for (let n = 0; n < numFiles; n++) {
      if (offset + ResourcePack.TABLE_ENTRY_SIZE_BYTES > data.length) {
        throw new Error("Data too short for table entry");
      }
      const tableEntryData = data.slice(
        offset,
        offset + ResourcePack.TABLE_ENTRY_SIZE_BYTES,
      );
      const [fileId, entry] =
        ResourcePackTableEntry.deserialize(tableEntryData);

      if (fileId === 0) {
        break;
      }

      if (fileId !== n + 1) {
        throw new Error(
          `File ID is expected to be ${n + 1}, but was ${fileId}`,
        );
      }

      resourcePack.tableEntries.push(entry);
      offset += ResourcePack.TABLE_ENTRY_SIZE_BYTES;
    }

    if (resourcePack.tableEntries.length !== numFiles) {
      throw new Error(
        `Number of files in manifest is ${numFiles}, but actual number is ${resourcePack.tableEntries.length}`,
      );
    }

    const uniqueOffsets = new Set<string>();
    for (const e of resourcePack.tableEntries) {
      uniqueOffsets.add(`${e.offset},${e.length}`);
    }
    const uniqueOffsetsList = Array.from(uniqueOffsets);

    for (const e of resourcePack.tableEntries) {
      e.contentIndex = uniqueOffsetsList.indexOf(`${e.offset},${e.length}`);
    }

    const loadedContentIndexes = new Set<number>();
    const sortedEntries = [...resourcePack.tableEntries].sort(
      (a, b) => a.contentIndex - b.contentIndex,
    );
    for (const entry of sortedEntries) {
      if (loadedContentIndexes.has(entry.contentIndex)) {
        continue;
      }

      loadedContentIndexes.add(entry.contentIndex);

      const contentOffset = entry.offset + resourcePack.contentStart;
      if (contentOffset + entry.length > data.length) {
        throw new Error("Content offset out of bounds");
      }
      const content = data.slice(contentOffset, contentOffset + entry.length);

      const calculatedCrc = crc32(content);

      if (calculatedCrc !== entry.crc) {
        throw new Error(
          `Entry ${entry} does not match CRC of content (${calculatedCrc}). Hint: try with${isSystem ? "out" : ""} the --system flag`,
        );
      }

      resourcePack.contents.push(content);
    }

    resourcePack.finalized = true;

    return resourcePack;
  }

  private finalize(): void {
    if (this.tableEntries.length > this.tableSize) {
      throw new Error(
        `Exceeded max number of resources. Must have ${this.tableSize} or fewer`,
      );
    }

    let currentOffset = this.contents.reduce((sum, c) => sum + c.length, 0);
    for (let i = this.tableEntries.length - 1; i >= 0; i--) {
      const tableEntry = this.tableEntries[i]!;
      if (tableEntry.offset === -1) {
        currentOffset -= tableEntry.length;

        for (const e of this.tableEntries) {
          if (e.contentIndex === tableEntry.contentIndex) {
            e.offset = currentOffset;
          }
        }
      }
    }

    this.crc = this.getContentCrc();

    this.finalized = true;
  }

  serialize(): Uint8Array {
    if (!this.finalized) {
      this.finalize();
    }

    const manifest = this.serializeManifest(this.crc);
    const table = this.serializeTable();
    const content = this.serializeContent();

    const totalLength = manifest.length + table.length + content.length;
    const result = new Uint8Array(totalLength);
    result.set(manifest, 0);
    result.set(table, manifest.length);
    result.set(content, manifest.length + table.length);
    return result;
  }

  addResource(content: Uint8Array): void {
    if (this.finalized) {
      throw new Error(
        "Cannot add additional resource, resource pack has already been finalized",
      );
    }

    let contentIndex: number;
    try {
      contentIndex = this.contents.findIndex((c) => {
        if (c.length !== content.length) return false;
        for (let i = 0; i < c.length; i++) {
          if (c[i] !== content[i]) return false;
        }
        return true;
      });
      if (contentIndex === -1) throw new Error();
    } catch {
      this.contents.push(content);
      contentIndex = this.contents.length - 1;
    }

    const crc = crc32(content);
    this.tableEntries.push(
      new ResourcePackTableEntry(contentIndex, -1, content.length, crc),
    );
  }

  dump(): void {
    console.log(`Manifest CRC: 0x${this.crc.toString(16)}`);
    console.log(`Calculated CRC: 0x${this.getContentCrc().toString(16)}`);
    console.log(`Num Items: ${this.tableEntries.length}`);
    for (let i = 0; i < this.tableEntries.length; i++) {
      const entry = this.tableEntries[i]!;
      console.log(
        `  ${i + 1}: Offset ${entry.offset} Length ${entry.length} CRC 0x${entry.crc.toString(16)}`,
      );
    }
  }
}
