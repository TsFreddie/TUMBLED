// Script to extract glyphs from unifont
import * as fontkit from "fontkit";
import { createCanvas } from "@napi-rs/canvas";

export class FontExtractor {
  private readonly font: fontkit.Font;

  constructor(file: string) {
    const font = fontkit.openSync(file);
    if (font.type !== "TTF") throw new Error("Font is not a TTF font");
    this.font = font;
  }

  supportCodePoint(codePoint: number) {
    const glyph = this.font.glyphForCodePoint(codePoint);
    if (glyph.id === 0) {
      return false;
    }

    return true;
  }

  convert(codePoint: number, fontSize: number) {
    const glyph = this.font.glyphForCodePoint(codePoint);
    if (glyph.id === 0) {
      return false;
    }

    // double the canvas just in case
    const canvasSize = fontSize * 2;
    const c = createCanvas(canvasSize, canvasSize);
    const ctx = c.getContext("2d");
    const render = glyph.path
      .scale(1, -1)
      .translate(0, this.font.bbox.maxY)
      .toFunction();

    let scale = (1 / this.font.unitsPerEm) * fontSize;
    ctx.scale(scale, scale);
    render(ctx as any);
    ctx.fill();
    const data = ctx.getImageData(0, 0, canvasSize, canvasSize);

    const advance = Math.round(glyph.advanceWidth * scale);

    // Find bounding box
    let left = canvasSize;
    let top = canvasSize;
    let right = -1;
    let bottom = -1;

    for (let i = 0; i < canvasSize; i++) {
      for (let j = 0; j < canvasSize; j++) {
        const index = (i * canvasSize + j) * 4 + 3;
        if (data.data[index] !== 0) {
          if (j < left) left = j;
          if (j > right) right = j;
          if (i < top) top = i;
          if (i > bottom) bottom = i;
        }
      }
    }

    // If no pixels found, set default values
    if (right === -1) {
      left = 0;
      top = 0;
      right = 0;
      bottom = 0;
    }

    let shapeLines = [];

    for (let i = top; i <= bottom; i++) {
      let line = "";
      for (let j = left; j <= right; j++) {
        const index = (i * canvasSize + j) * 4 + 3;
        line += data.data[index] === 0 ? " " : "#";
      }
      shapeLines.push(line.trimEnd());
    }

    return {
      shape: shapeLines.join("\n"),
      top,
      left,
      advance,
    };
  }
}
