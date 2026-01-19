import { readPbf } from "../lib/pbf_reader";
import { PBFBuilder } from "../lib/pbf_builder";
import { parseArgs } from "util";
import fs from "fs";
import path from "path";

const copyShape = (
  src: Uint8Array,
  sw: number,
  sh: number,
  dest: Uint8Array,
  dw: number,
  dh: number,
  x: number,
  y: number,
) => {
  for (let sy = 0; sy < sh; sy++) {
    const destY = y + sy;
    if (destY < 0 || destY >= dh) continue;
    for (let sx = 0; sx < sw; sx++) {
      const destX = x + sx;
      if (destX < 0 || destX >= dw) continue;
      const srcData = src[sy * sw + sx];
      if (srcData) {
        dest[destY * dw + destX] = srcData;
      }
    }
  }
};

const { positionals, values } = parseArgs({
  args: process.argv,
  strict: false,
  allowPositionals: true,
  options: {
    out: {
      type: "string",
      short: "o",
    },
  },
});

const operation = positionals[2];

if (operation === "readchar") {
  const file = positionals[3];
  if (!file) {
    console.error("No file specified");
    process.exit(1);
  }

  const char = parseInt(positionals[4]!);
  if (isNaN(char)) {
    console.error("Invalid codepoint");
    process.exit(1);
  }

  const font = readPbf(fs.readFileSync(file));
  const glyph = font.read(char);
  console.log(`Width: ${glyph.width}`);
  console.log(`Height: ${glyph.height}`);
  console.log(`Advance: ${glyph.advance}`);
  console.log(`Top: ${glyph.top}`);
  console.log(`Left: ${glyph.left}`);
  console.log(glyph.data);
  process.exit(0);
}

if (operation === "dump") {
  const file = positionals[3];
  if (!file) {
    console.error("No file specified");
    process.exit(1);
  }

  const font = readPbf(fs.readFileSync(file));

  const dirname = file + "_dump";
  fs.mkdirSync(dirname, { recursive: true });

  fs.writeFileSync(
    dirname + "/font.json",
    JSON.stringify({
      height: font.maxHeight,
      wildcardCodepoint: font.wildcardCodepoint,
    }),
  );

  for (const key of Object.keys(font.offsetTables)) {
    const codepoint = parseInt(key);
    if (isNaN(codepoint)) {
      console.warn(`Invalid key ${key}`);
      continue;
    }
    const glyph = font.read(codepoint);
    const name = String.fromCodePoint(codepoint);
    if (!name) {
      console.warn(`Invalid codepoint ${codepoint}`);
    }

    const lines = [`${glyph.advance} ${glyph.top} ${glyph.left}`];
    lines.push(...glyph.data.split("\n").map((line) => line.trimEnd()));
    fs.writeFileSync(path.join(dirname, `${codepoint}.txt`), lines.join("\n"));
  }

  process.exit(0);
}

if (operation === "build" || operation === "buildbold") {
  const dirname = positionals[3];
  if (!dirname) {
    console.error("No directory specified");
    process.exit(1);
  }

  const font = JSON.parse(
    fs.readFileSync(path.join(dirname, "font.json"), "utf8"),
  );

  if (!font.height || !font.wildcardCodepoint) {
    console.error("Invalid font.json");
    process.exit(1);
  }

  const builder = new PBFBuilder(font.height, font.wildcardCodepoint);

  const glyphDir = path.join(dirname, "glyphs");
  const shapeDir = path.join(dirname, "shapes");

  const shapes: Record<
    string,
    {
      top: number;
      left: number;
      width: number;
      height: number;
      data: Uint8Array;
    }
  > = Object.fromEntries(
    fs
      .readdirSync(shapeDir)
      .map((name) => {
        const shapeName = path.basename(name, ".txt");
        if (!shapeName) {
          console.warn("Invalid shape file name: " + name);
          return null;
        }
        const data = fs.readFileSync(path.join(shapeDir, name), "utf8");
        const lines = data.split("\n");
        const [top, left] = lines[0].split(" ").map(Number);

        if (top === undefined || left === undefined) {
          console.warn("Invalid shape header: " + name);
          return null;
        }

        const shapeData = lines.slice(1);
        const width = Math.max(0, ...shapeData.map((line) => line.length));
        const height = shapeData.length;
        const buffer = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            buffer[y * width + x] = shapeData[y][x] === "#" ? 1 : 0;
          }
        }

        return [shapeName, { top, left, width, height, data: buffer }];
      })
      .filter((shape) => shape !== null),
  );

  const glyphs = fs.readdirSync(glyphDir);

  const bold = operation === "buildbold";

  for (const glyphFile of glyphs.filter((f) => f.endsWith(".txt"))) {
    const codepoint = parseInt(glyphFile.split(".")[0]!);
    if (isNaN(codepoint)) {
      console.warn("Invalid codepoint in file name: " + glyphFile);
      continue;
    }

    const glyph = fs.readFileSync(path.join(glyphDir, glyphFile), "utf8");
    const lines = glyph.split("\n");
    const header = lines[0];
    if (!header) {
      console.warn("Invalid glyph file: " + glyphFile);
      continue;
    }

    let [advance] = header.split(" ").map(Number);
    if (advance === undefined) {
      console.warn("Invalid glyph header: " + glyphFile);
      continue;
    }

    if (bold) {
      // increase advance for bold font
      advance += 1;
    }

    const shapeDefs = lines.slice(1);
    while (shapeDefs.length > 0 && shapeDefs[shapeDefs.length - 1] === "") {
      shapeDefs.pop();
    }

    const glyphShapes: {
      top: number;
      left: number;
      shape: (typeof shapes)[string];
    }[] = [];

    for (const shapeDef of shapeDefs) {
      const [top, left, shapeName] = shapeDef.split(" ");
      if (top === undefined || left === undefined || !shapeName) {
        console.warn(
          "Invalid shape definition: " + shapeDef + " in " + glyphFile,
        );
        continue;
      }
      const shape = shapes[shapeName];
      if (!shape) {
        console.warn("Shape not found: " + shapeName + " in " + glyphFile);
        continue;
      }

      glyphShapes.push({
        top: Number(top),
        left: Number(left),
        shape,
      });
    }

    let bufferWidth = 0;
    let bufferHeight = 0;

    for (const glyphShape of glyphShapes) {
      bufferWidth = Math.max(
        bufferWidth,
        glyphShape.left + glyphShape.shape.left + glyphShape.shape.width,
      );
      bufferHeight = Math.max(
        bufferHeight,
        glyphShape.top + glyphShape.shape.top + glyphShape.shape.height,
      );
    }

    if (bold) {
      bufferWidth += 1;
    }

    const buffer = new Uint8Array(bufferWidth * bufferHeight);
    for (const glyphShape of glyphShapes) {
      copyShape(
        glyphShape.shape.data,
        glyphShape.shape.width,
        glyphShape.shape.height,
        buffer,
        bufferWidth,
        bufferHeight,
        glyphShape.left + glyphShape.shape.left,
        glyphShape.top + glyphShape.shape.top,
      );

      if (bold) {
        copyShape(
          glyphShape.shape.data,
          glyphShape.shape.width,
          glyphShape.shape.height,
          buffer,
          bufferWidth,
          bufferHeight,
          glyphShape.left + glyphShape.shape.left + 1,
          glyphShape.top + glyphShape.shape.top,
        );
      }
    }

    if (bufferHeight === 0 || bufferWidth === (bold ? 1 : 0)) {
      builder.addGlyph(codepoint, {
        advance,
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        data: [],
      });
      continue;
    }

    let top = bufferHeight;
    let left = bufferWidth;
    let right = 0;
    let bottom = 0;

    // find bounding box of data
    for (let y = 0; y < bufferHeight; y++) {
      for (let x = 0; x < bufferWidth; x++) {
        if (buffer[y * bufferWidth + x]) {
          top = Math.min(top, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }

    const width = right - left + 1;
    const height = bottom - top + 1;

    const data = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[y * width + x] = buffer[(y + top) * bufferWidth + (x + left)];
      }
    }

    builder.addGlyph(codepoint, {
      advance,
      top,
      left,
      width,
      height,
      data: Array.from(data),
    });
  }

  const outfileName =
    typeof values.out === "string"
      ? values.out
      : dirname + (bold ? "_bold.pbf" : ".pbf");
  const build = builder.build();
  if (build.ignoredGlyphs.length > 0) {
    console.warn(
      `Ignored ${build.ignoredGlyphs.length} glyphs: ` +
        build.ignoredGlyphs
          .map((g) => `${String.fromCodePoint(g.codepoint)}(${g.codepoint})`)
          .join(", "),
    );
  }

  console.log(
    `Writing ${build.buffer.length} bytes to ${outfileName}. Compressed: ${build.compressed}`,
  );
  fs.writeFileSync(outfileName, build.buffer);
  process.exit(0);
}

console.error("Unknown operation: " + operation);
process.exit(1);
