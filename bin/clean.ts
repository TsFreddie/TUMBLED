// Clean up script

import fs from "fs";
import path from "path";

const fonts = fs.readdirSync("./fonts");

const write = process.argv.includes("--write");

fonts.forEach((font) => {
  const shapeDir = `./fonts/${font}/shapes`;
  const glyphDir = `./fonts/${font}/glyphs`;
  if (!fs.existsSync(shapeDir) || !fs.existsSync(glyphDir)) {
    return;
  }

  const shapes = new Set(
    fs.readdirSync(shapeDir).map((shape) => path.basename(shape, ".txt")),
  );
  const glyphs = fs.readdirSync(glyphDir);

  const unusedShape = new Set<string>(shapes);

  for (const glyph of glyphs) {
    const glyphPath = path.join(glyphDir, glyph);
    const glyphContent = fs.readFileSync(glyphPath, "utf-8");
    const glyphShapes = glyphContent
      .split("\n")
      .slice(1)
      .map((line) => line.split(" ")[2])
      .filter((shape) => shape !== undefined);
    glyphShapes.forEach((shape) => unusedShape.delete(shape));
  }

  console.log(`Unused shapes in ${font}:`);
  console.log(Array.from(unusedShape).join(","));

  if (write) {
    unusedShape.forEach((shape) => {
      fs.rmSync(path.join(shapeDir, `${shape}.txt`));
    });
    console.log(`Cleaned up ${unusedShape.size} unused shapes in ${font}`);
  }
});
