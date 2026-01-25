// Script to dedup all characters in the CJK directory
import fs from "node:fs";
import { FontExtractor } from "./extractor";

const hardCap = 10922;
const cjkCap = 10500;

// Supported in pebble GOTHIC
const ignores = new Set([
  32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88,
  89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106,
  107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121,
  122, 123, 124, 125, 126, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169,
  170, 171, 172, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185,
  186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200,
  201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 216,
  217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231,
  232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246,
  247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261,
  262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276,
  277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291,
  292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306,
  307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321,
  322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336,
  337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351,
  352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365, 366,
  367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 380, 381,
  382, 383, 402, 508, 509, 510, 511, 536, 537, 538, 539, 710, 711, 728, 729,
  730, 731, 732, 733, 960, 8211, 8212, 8216, 8217, 8218, 8220, 8221, 8222, 8224,
  8225, 8226, 8230, 8240, 8249, 8250, 8260, 8364, 8482, 8486, 8706, 8710, 8719,
  8721, 8722, 8730, 8734, 8747, 8776, 8800, 8804, 8805, 9647, 9674, 63171,
  64257, 64258,
]);

const listStandards = fs.readdirSync("./data/pages/standards");
const listExtra = fs.readdirSync("./data/pages/extra");
const listOthers = fs.readdirSync("./data/pages/others");

const frequencyMap: Record<string, number> = Object.fromEntries(
  fs
    .readFileSync("./data/FREQUENCY", "utf8")
    .split("\n")
    .filter((s) => s)
    .map((s, i) => [s, i]),
);

const result = new Set<string>();
const segmentor = new Intl.Segmenter(undefined, { granularity: "grapheme" });

const unifont = new FontExtractor("data/fonts/unifont/unifont-17.0.03.otf");

const isSupported = (char: string) => {
  const codepoint = char.codePointAt(0);
  if (codepoint === undefined) {
    console.log(`${char} unsupported codepoints`);
    return false;
  }

  if (codepoint > 65535) {
    console.log(`${char} (${codepoint}) exceeds 16 bits`);
    return false;
  }

  if (ignores.has(codepoint)) {
    console.log(`${char} (${codepoint}) is ignored`);
  }

  if (!unifont.supportCodePoint(codepoint)) {
    console.log(`${char} (${codepoint}) is not supported by unifont`);
    return false;
  }

  return true;
};

for (const file of listStandards) {
  const content = fs.readFileSync(`./data/pages/standards/${file}`, "utf8");
  const characters = Array.from(segmentor.segment(content)).map(
    (s) => s.segment,
  );
  for (const char of characters) {
    if (!isSupported(char)) continue;
    result.add(char);
  }
}

for (const file of listExtra) {
  const content = fs.readFileSync(`./data/pages/extra/${file}`, "utf8");
  const characters = Array.from(segmentor.segment(content)).map(
    (s) => s.segment,
  );

  const addedExtra = [];

  for (const char of characters) {
    if (!isSupported(char)) continue;
    if (result.has(char)) continue;

    addedExtra.push(char);
    result.add(char);
  }

  if (result.size > cjkCap) {
    console.warn(`WARNING: exceeds glyph cap of ${cjkCap}! Removing extra...`);

    addedExtra.sort((a, b) => frequencyMap[a] - frequencyMap[b]);
    const removed = [];

    while (addedExtra.length > 0 && result.size > cjkCap) {
      const char = addedExtra.pop()!;
      removed.push(char);
      result.delete(char);
    }

    console.log(
      `Removed ${removed.length} characters: ${removed.reverse().join("")}`,
    );
  }
}

for (const file of listOthers) {
  const content = fs.readFileSync(`./data/pages/others/${file}`, "utf8");
  const characters = Array.from(segmentor.segment(content)).map(
    (s) => s.segment,
  );

  for (const char of characters) {
    if (!isSupported(char)) continue;
    if (result.has(char)) continue;
    if (result.size >= hardCap) {
      console.log(`Ignoring ${char} (${char.charCodeAt(0)!}) due to hard cap`);
    }
    result.add(char);
  }
}

console.log("Deduped all characters in the CJK directory");
console.log(`Total characters: ${result.size}`);

fs.mkdirSync("./build", { recursive: true });
fs.writeFileSync(
  "./build/pages.txt",
  Array.from(result)
    .sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!)
    .join(""),
);
