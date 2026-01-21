// Script to dedup all characters in the CJK directory
import fs from "node:fs";
import { FontExtractor } from "./extractor";

const hardCap = 10922;
const cjkCap = 10500;

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

  if (!unifont.supportCodePoint(char.charCodeAt(0))) {
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
