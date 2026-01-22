// Script to extract glyphs from unifont
import freetype from "freetype2";

export class FontExtractor {
  private readonly font: freetype.FontFace;

  constructor(file: string, index?: number) {
    if (!index) index = 0;
    const font = freetype.NewFace(file, index);
    this.font = font;
  }

  supportCodePoint(codePoint: number) {
    const glyph = this.font.getCharIndex(codePoint);
    if (!glyph) {
      return false;
    }

    return true;
  }

  convert(
    codePoint: number,
    fontSizeW: number,
    fontSizeH?: number,
    forceAutohint?: boolean,
  ) {
    const index = this.font.getCharIndex(codePoint);
    if (!index) {
      return false;
    }

    if (!fontSizeH) {
      fontSizeH = fontSizeW;
    }

    this.font.setPixelSizes(fontSizeW, fontSizeH);

    const glyph = this.font.loadGlyph(index, {
      forceAutohint: forceAutohint,
      loadTarget: freetype.RenderMode.MONO,
      monochrome: true,
      render: true,
    });

    const bitmap = glyph.bitmap;
    if (!bitmap) {
      return false;
    }

    const getBit = (x: number, y: number) => {
      const byteIndex = Math.floor(x / 8) + y * bitmap.pitch;
      const bitIndex = 7 - (x % 8);
      return (bitmap.buffer[byteIndex] & (1 << bitIndex)) !== 0;
    };

    // Find bounding box
    let left = bitmap.width;
    let top = bitmap.height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < bitmap.height; y++) {
      for (let x = 0; x < bitmap.width; x++) {
        if (getBit(x, y)) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
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

    for (let y = top; y <= bottom; y++) {
      let line = "";
      for (let x = left; x <= right; x++) {
        line += !getBit(x, y) ? " " : "#";
      }
      shapeLines.push(line.trimEnd());
    }

    return {
      shape: shapeLines.join("\n"),
      top: fontSizeH - (glyph.bitmapTop || 0),
      left: (glyph.bitmapLeft || 0) + left,
      advance: Math.round(glyph.metrics.horiAdvance / 64),
    };
  }
}
