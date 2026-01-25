// Script to extract glyphs from unifont
import freetype from "freetype2";

const PREFERD_PATTERNS = [
  `
   
 ##
 # 
`,
  `
   
## 
 # 
`,
  `
 # 
 ##
   
`,
  `
 # 
## 
   
`,
].map((pattern) => {
  const lines = pattern.split("\n").slice(1);
  lines.pop();

  const width = Math.max(0, ...lines.map((line) => line.length));
  const height = lines.length;

  const shape = lines.map((line) => line.split(""));

  return {
    shape,
    width,
    height,
  };
});

export const jiggleScore = (
  targetWidth: number,
  targetHeight: number,
  shape: {
    shape: string;
    top: number;
    left: number;
    advance: number;
  },
) => {
  const lines = shape.shape.split("\n").map((line) => line.split(""));
  const width = Math.max(...lines.map((line) => line.length));
  const height = lines.length;

  let totalScore = 0;

  // HORIZONTAL SCORE
  for (let y = 0; y < height; y++) {
    let left = shape.left;
    let right = shape.left + width;

    for (let x = 0; x < width; x++) {
      if (lines[y][x] === "#") {
        left = shape.left + x;
        break;
      }
    }

    for (let x = width - 1; x >= 0; x--) {
      if (lines[y][x] === "#") {
        right = shape.left + x;
        break;
      }
    }

    let score = 0;
    const leftPanalty = Math.max(0, left);
    const rightPanalty = Math.max(0, targetWidth - right - 1);
    score -= Math.abs(leftPanalty - rightPanalty);

    if (right >= targetWidth) {
      score -= targetWidth * (right - targetWidth + 1);
    }

    if (left <= -1) {
      score -= targetWidth * -left;
    }

    totalScore += score;
  }

  // VERTICAL SCORE
  for (let x = 0; x < width; x++) {
    let top = shape.top;
    let bottom = shape.top + height;

    for (let y = 0; y < height; y++) {
      if (lines[y][x] === "#") {
        top = shape.top + y;
        break;
      }
    }

    for (let y = height - 1; y >= 0; y--) {
      if (lines[y][x] === "#") {
        bottom = shape.top + y;
        break;
      }
    }

    let score = 0;
    const topPanalty = Math.max(0, top);
    const bottomPanalty = Math.max(0, targetHeight - bottom - 1);
    score -= Math.abs(topPanalty - bottomPanalty);

    if (bottom >= targetHeight) {
      score -= targetHeight * (bottom - targetHeight + 1);
    }

    if (top <= -1) {
      score -= targetHeight * -top;
    }

    totalScore += score;
  }

  // PREFER CERTAIN PATTERN

  for (const pattern of PREFERD_PATTERNS) {
    const patternWidth = pattern.width;
    const patternHeight = pattern.height;

    // Check if pattern fits within the shape
    for (let startY = -patternHeight; startY <= height; startY++) {
      for (let startX = -patternWidth; startX <= width; startX++) {
        let matches = true;

        for (let py = 0; py < patternHeight; py++) {
          for (let px = 0; px < patternWidth; px++) {
            const patternChar = pattern.shape[py][px] || " ";
            const shapeChar = lines[startY + py]?.[startX + px] || " ";

            if (patternChar !== shapeChar) {
              matches = false;
              break;
            }
          }
          if (!matches) break;
        }

        if (matches) {
          totalScore += Math.floor((targetHeight + targetWidth) / 2);
        }
      }
    }
  }

  return totalScore;
};

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

  listAllCodePoints() {
    let codepoints: number[] = [];
    let char = this.font.getFirstChar();
    while (char) {
      codepoints.push(char.charCode);
      char = this.font.getNextChar(char.charCode);
    }

    return codepoints;
  }

  autoJiggle(
    codePoint: number,
    targetWidth: number,
    targetHeight: number,
    fontSizeW: number,
    fontSizeH?: number,
    forceAutohint?: boolean,
  ) {
    let bestScore = -Infinity;
    let bestShape:
      | false
      | {
          shape: string;
          top: number;
          left: number;
          advance: number;
        } = false;

    for (let x = 0; x < 32; x++) {
      for (let y = 0; y < 32; y++) {
        const result = this.convert(
          codePoint,
          fontSizeW,
          fontSizeH,
          forceAutohint,
          undefined,
          [64 - x * 4, 64 - y * 4],
        );

        if (result) {
          const score = jiggleScore(targetWidth, targetHeight, result);
          if (score > bestScore) {
            bestScore = score;
            bestShape = result;
          }
        }
      }
    }

    return bestShape;
  }

  convert(
    codePoint: number,
    fontSizeW: number,
    fontSizeH?: number,
    forceAutohint?: boolean,
    matrix?: [number, number, number, number],
    vector?: [number, number],
  ) {
    const index = this.font.getCharIndex(codePoint);
    if (!index) {
      return false;
    }

    if (!fontSizeH) {
      fontSizeH = fontSizeW;
    }

    this.font.setTransform(matrix, vector);
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
      advance: glyph.metrics.horiAdvance / 64,
    };
  }
}
