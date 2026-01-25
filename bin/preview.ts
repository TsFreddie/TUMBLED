// Script for generating preview
import { parseArgs } from "util";
import { readPbf } from "../lib/pbf_reader";
import { createCanvas, Image } from "@napi-rs/canvas";
import * as fs from "fs";
import * as path from "path";

// Show help if --help is provided
if (process.argv.includes("--help")) {
  console.log(`
Usage: preview.ts [options] <pbf-file> [pbf-file ...]

Generate a preview image from PBF font files.

Options:
  -o, --out <path>        Output file path (default: ./images/preview.png)
  -w, --width <pixels>    Canvas width in pixels (optional, enables greedy layouting)
  -h, --height <pixels>   Canvas height in pixels (optional)
  -l, --line-height <pixels>  Line height in pixels (default: auto-calculated based on glyphs)
  -t, --text <string>     Sample text to render (default: "こんにちは Hello 你好世界지금 이 순간我们一起出发")
  --text-file <path>      Read sample text from file

Examples:
  preview.ts font.pbf
  preview.ts font.pbf -o output.png -w 800 -h 600
  preview.ts font.pbf -t "Hello World"
  preview.ts font.pbf --text-file sample.txt -w 1024
  preview.ts font1.pbf font2.pbf -o preview.png -w 800 -t "Sample text"
  preview.ts font.pbf -w 800 -l 24 -t "Multi-line text with custom spacing"
  `);
  process.exit(0);
}

const { positionals, values } = parseArgs({
  args: process.argv,
  strict: false,
  allowPositionals: true,
  options: {
    out: {
      type: "string",
      short: "o",
    },
    width: {
      type: "string",
      short: "w",
    },
    height: {
      type: "string",
      short: "h",
    },
    "line-height": {
      type: "string",
      short: "l",
    },
    text: {
      type: "string",
      short: "t",
    },
    "text-file": {
      type: "string",
    },
  },
});

const files = positionals.slice(2);
if (files.length === 0) {
  console.error("No pbf files specified");
  process.exit(1);
}

const outFile =
  typeof values.out == "string" ? values.out : "./images/preview.png";

// Parse canvas size arguments
const canvasWidth =
  typeof values.width == "string" ? parseInt(values.width, 10) : null;
const canvasHeight =
  typeof values.height == "string" ? parseInt(values.height, 10) : null;
const customLineHeight =
  typeof values["line-height"] == "string"
    ? parseInt(values["line-height"], 10)
    : null;

// Get text from command line or file
let text =
  "こんにちは Hello World 你好世界 지금 이 순간 Have a good day 生活其實很簡單 「Bonjour!」 早安！從一句問候開始，連結起 하루 的美好。Look up. 仰望天空吧。空はどこまでも青い，希望也無窮無盡。晨光中，我在公園裡聽見孩子們喊「Let's play!」，그 소리 정말 즐겁다。轉角買了杯熱美式，咖啡師笑著說「Have a nice day!」。旁邊長椅上，一位老人正輕聲讀著俳句：「古池や蛙飛び込む水の音」。我忽然覺得，この瞬間、世界は完璧だ——這個瞬間，世界是完美的。風吹過，桜の花びら飄落在我的筆記本上，旁邊寫著一行小字：「微小的幸福，才是生活的本質。」";
if (typeof values.text == "string") {
  text = values.text;
} else if (typeof values["text-file"] == "string") {
  const textFilePath = values["text-file"];
  if (fs.existsSync(textFilePath)) {
    text = fs.readFileSync(textFilePath, "utf-8");
  } else {
    console.error(`Text file not found: ${textFilePath}`);
    process.exit(1);
  }
}

const padding = 4;
const scale = 1;

// Load all PBF files
const fonts = files.map((file) => {
  const buffer = fs.readFileSync(file);
  return readPbf(buffer);
});

// Glyph info interface
interface GlyphInfo {
  codepoint: number;
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
  data: string;
}

// Find glyph across multiple fonts (from last to first)
const findGlyph = (codepoint: number): GlyphInfo | null => {
  for (let i = fonts.length - 1; i >= 0; i--) {
    try {
      const glyph = fonts[i].read(codepoint);
      return {
        codepoint,
        x: 0,
        y: 0,
        width: glyph.width,
        height: glyph.height,
        left: glyph.left,
        top: glyph.top,
        advance: glyph.advance,
        data: glyph.data,
      };
    } catch (e) {
      // Glyph not found in this font, continue to next
    }
  }

  // If no glyph found, use wildcard from last font
  const lastFont = fonts[fonts.length - 1];
  try {
    const glyph = lastFont.read(lastFont.wildcardCodepoint);
    return {
      codepoint,
      x: 0,
      y: 0,
      width: glyph.width,
      height: glyph.height,
      left: glyph.left,
      top: glyph.top,
      advance: glyph.advance,
      data: glyph.data,
    };
  } catch (e) {
    return null;
  }
};

// Preprocess glyphs and calculate positions with greedy layouting
const preprocessGlyphs = (): {
  glyphs: GlyphInfo[];
  width: number;
  height: number;
} => {
  const glyphs: GlyphInfo[] = [];
  let cursorX = padding;
  let cursorY = padding;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let lineHeight = 0;
  let isFirstCharOfLine = true;

  // Helper function to check if a character is an English letter
  const isEnglishLetter = (char: string): boolean => {
    return /^[a-zA-Z]$/.test(char);
  };

  // Helper function to check if a character is a space
  const isSpace = (char: string): boolean => {
    return char === " ";
  };

  // Temporary layout for pending glyphs
  let tempGlyphs: GlyphInfo[] = [];
  let tempWidth = 0;
  let tempCursorX = 0;
  let tempLineHeight = 0;

  const commitTemp = () => {
    if (customLineHeight === null) {
      lineHeight = Math.max(lineHeight, tempLineHeight);
    }

    for (const tempGlyph of tempGlyphs) {
      tempGlyph.x += cursorX;
      tempGlyph.y += cursorY;
      glyphs.push(tempGlyph);
      minX = Math.min(minX, tempGlyph.x);
      minY = Math.min(minY, tempGlyph.y);
      maxX = Math.max(maxX, tempGlyph.x + tempGlyph.width);
      maxY = Math.max(maxY, tempGlyph.y + tempGlyph.height);
      isFirstCharOfLine = false;
    }

    cursorX += tempCursorX;

    tempGlyphs = [];
    tempWidth = 0;
    tempCursorX = 0;
    tempLineHeight = 0;
  };

  const newLine = () => {
    cursorX = padding;
    cursorY += customLineHeight !== null ? customLineHeight : lineHeight;
    lineHeight = 0;
    isFirstCharOfLine = true;
  };

  for (const char of text) {
    // Skip leading spaces on new lines
    if (isFirstCharOfLine && isSpace(char)) {
      continue;
    }

    const codepoint = char.codePointAt(0)!;
    const glyph = findGlyph(codepoint);

    if (!glyph) {
      continue;
    }

    // Update glyph position
    glyph.x = tempCursorX + glyph.left;
    glyph.y = glyph.top;

    // Add to temporary layout
    tempGlyphs.push(glyph);
    tempWidth = Math.max(tempWidth, glyph.x + glyph.width);
    tempLineHeight = Math.max(tempLineHeight, glyph.y + glyph.height);

    // Advance cursor
    tempCursorX += glyph.advance;

    // Check if this is a non-English letter (word boundary)
    if (!isEnglishLetter(char)) {
      // Check if the temporary bound fits in this line
      if (canvasWidth !== null && cursorX + tempWidth > canvasWidth - padding) {
        newLine();
      }
      commitTemp();
    }
  }

  if (tempGlyphs.length > 0) {
    commitTemp();
  }

  // Calculate final dimensions
  let width = maxX - minX + padding * 2;
  let height = maxY - minY + padding * 2;

  // Use specified canvas dimensions if provided
  if (canvasWidth !== null) {
    width = canvasWidth;
  }
  if (canvasHeight !== null) {
    height = canvasHeight;
  }

  // Adjust all glyph positions to be relative to the bounding box
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  for (const glyph of glyphs) {
    glyph.x += offsetX;
    glyph.y += offsetY;
  }

  return { glyphs, width, height };
};

// Draw glyphs to canvas
const drawGlyphs = (
  glyphs: GlyphInfo[],
  width: number,
  height: number,
): Buffer => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Set background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Draw each glyph
  for (const glyph of glyphs) {
    const lines = glyph.data.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const pixel = line[j];
        if (pixel === "#") {
          ctx.fillStyle = "#000000";
          ctx.fillRect(glyph.x + j, glyph.y + i, 1, 1);
        }
      }
    }
  }

  return canvas.toBuffer("image/png");
};

const scaleCanvas = (
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> => {
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const scaledCanvas = createCanvas(scaledWidth, scaledHeight);
  const ctx = scaledCanvas.getContext("2d");

  // Disable image smoothing for pixelated look
  ctx.imageSmoothingEnabled = false;

  // Load original image and draw scaled
  const originalImage = new Image();
  originalImage.src = `data:image/png;base64,${buffer.toString("base64")}`;

  // Wait for image to load before drawing
  return new Promise<Buffer>((resolve) => {
    originalImage.onload = () => {
      ctx.drawImage(originalImage, 0, 0, scaledWidth, scaledHeight);
      resolve(scaledCanvas.toBuffer("image/png"));
    };
  });
};

// Main execution
(async () => {
  const { glyphs, width, height } = preprocessGlyphs();
  const buffer = drawGlyphs(glyphs, width, height);
  const scaledBuffer = await scaleCanvas(buffer, width, height);

  // Ensure output directory exists
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Save to output file
  fs.writeFileSync(outFile, scaledBuffer);

  console.log(`Preview saved to ${outFile}`);
})();
