// Script for generating preview
import { parseArgs } from "util";
import { readPbf } from "../lib/pbf_reader";
import { createCanvas, Image } from "@napi-rs/canvas";
import * as fs from "fs";
import * as path from "path";

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

const files = positionals.slice(2);
if (files.length === 0) {
  console.error("No pbf files specified");
  process.exit(1);
}

const outFile = typeof values.out == "string" ? values.out : "./images/preview.png";

const text = "こんにちは Hello 你好世界지금 이 순간我们一起出发";

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

// Preprocess glyphs and calculate positions
const preprocessGlyphs = (): { glyphs: GlyphInfo[]; width: number; height: number } => {
  const glyphs: GlyphInfo[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  
  for (const char of text) {
    const codepoint = char.codePointAt(0)!;
    const glyph = findGlyph(codepoint);
    
    if (!glyph) {
      continue;
    }
    
    // Calculate render position
    const renderX = cursorX + glyph.left;
    const renderY = cursorY + glyph.top;
    
    // Update glyph position
    glyph.x = renderX;
    glyph.y = renderY;
    
    // Track bounding box
    minX = Math.min(minX, renderX);
    minY = Math.min(minY, renderY);
    maxX = Math.max(maxX, renderX + glyph.width);
    maxY = Math.max(maxY, renderY + glyph.height);
    
    glyphs.push(glyph);
    
    // Advance cursor
    cursorX += glyph.advance;
  }
  
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  
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
const drawGlyphs = (glyphs: GlyphInfo[], width: number, height: number): Buffer => {
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

const scaleCanvas = (buffer: Buffer, width: number, height: number): Promise<Buffer> => {
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
