import { $ } from "bun";
import fs from "fs";
import path from "path";

// Written into every pack's translation header.
const VERSION = "1.7";

// Language packs to build. A `po` entry is a vendored catalog from
// coredevices/pebbleos-translations (see locale/README.md). Older PBF-only
// packs carry no catalog at all, so the system keeps its built-in English
// strings while still rendering CJK with the TUMBLED fonts.
const LANGS = [
  { code: "en_CN", name: "English + TUMBLED" },
  { code: "zh_CN", name: "简体中文 + TUMBLED", po: "locale/zh_CN.po" },
];

// The CJK month names (一月 … 十月) plus the ellipsis and the wildcard box,
// for the ROBOTO_CONDENSED_21_EXTENDED slot of both watches.
const MONTHS = "data/016";

// Font slots of each watch, in resource order. `null` leaves the slot empty
// so the firmware keeps whatever it already has for that size.
const P2D_SLOTS = [
  "TUMBLED_14",
  "TUMBLED_14_BOLD",
  "TUMBLED_18",
  "TUMBLED_18_BOLD",
  "TUMBLED_24",
  "TUMBLED_24_BOLD",
  "TUMBLED_28",
  "TUMBLED_28_BOLD",
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  MONTHS,
  null,
  null,
];

const PT2_SLOTS = [
  "TUMBLED_14",
  "TUMBLED_14_BOLD",
  "TUMBLED_18",
  "TUMBLED_18_BOLD",
  "TUMBLED_24",
  "TUMBLED_24_BOLD",
  "TUMBLED_28",
  "TUMBLED_28_BOLD",
  "TUMBLED_36",
  "TUMBLED_36_BOLD",
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  MONTHS,
  null,
  null,
];

// Reduced packs point the bold-only slots at the font notifications actually
// reach, so every built-in text size stays a distinct design. MINI
// additionally aliases 18_BOLD, which only the Medium content size uses.
const ALIASES = {
  P2D_LITE: {
    TUMBLED_14_BOLD: "TUMBLED_14",
    TUMBLED_24: "TUMBLED_24_BOLD",
    TUMBLED_28_BOLD: "TUMBLED_28",
  },
  PT2_LITE: {
    TUMBLED_14_BOLD: "TUMBLED_14",
    TUMBLED_36_BOLD: "TUMBLED_36",
  },
  PT2_MINI: {
    TUMBLED_14_BOLD: "TUMBLED_14",
    TUMBLED_18_BOLD: "TUMBLED_18",
    TUMBLED_36_BOLD: "TUMBLED_36",
  },
};

// One pack per watch and reduction level, TUMBLED_<locale>_<pack>.pbl.
const PACKS = [
  { name: "P2D", slots: P2D_SLOTS, aliases: null },
  { name: "P2D_LITE", slots: P2D_SLOTS, aliases: "P2D_LITE" },
  { name: "PT2", slots: PT2_SLOTS, aliases: null },
  { name: "PT2_LITE", slots: PT2_SLOTS, aliases: "PT2_LITE" },
  { name: "PT2_MINI", slots: PT2_SLOTS, aliases: "PT2_MINI" },
];

const SIZES = [14, 18, 24, 28, 36];

// The 36 bold is the auto bold grown on both axes (right and up), which
// thickens horizontal strokes too and keeps the weight even unlike the
// one-axis version. The other sizes come out even from the extraction alone.
const BOLD_FLAGS = { 36: ["--bold-height", "1"] };

const skipPreviews = process.argv.includes("--skip-previews");

fs.mkdirSync("build/", { recursive: true });

// The fonts are language independent, so build them once.

for (const size of SIZES) {
  await $`bun run ./PebbleFontTool/bin/pbf build ./fonts/TUMBLED_${size} -o build/TUMBLED_${size}.pbf`;
  await $`bun run ./PebbleFontTool/bin/pbf buildbold ./fonts/TUMBLED_${size} -o build/TUMBLED_${size}_BOLD.pbf ${BOLD_FLAGS[size] ?? []}`;

  if (!skipPreviews) {
    await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_${size}.pbf build/TUMBLED_${size}.pbf -o images/TUMBLED_${size}.png -w 200 -h 228 -l ${size}`;
    await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_${size}_BOLD.pbf build/TUMBLED_${size}_BOLD.pbf -o images/TUMBLED_${size}_BOLD.png -w 200 -h 228 -l ${size}`;
  }
}

// A vendored catalog is used as-is except for the version and the name, which
// keep the packs identifiable on the watch.

function translation(lang) {
  if (!lang.po) {
    return `msgid ""
msgstr ""
"Project-Id-Version: ${VERSION}\\n"
"Language: ${lang.code}\\n"
"Name: ${lang.name}\\n"
"Content-Type: text/plain; charset=utf-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
`;
  }

  const source = fs.readFileSync(lang.po, "utf8");
  const version = /^"Project-Id-Version:.*"$/mu;
  const name = /^"Name:.*"$/mu;
  if (!version.test(source) || !name.test(source)) {
    throw new Error(`${lang.po}: no Project-Id-Version/Name in the header`);
  }
  return source
    .replace(version, `"Project-Id-Version: ${VERSION}\\n"`)
    .replace(name, `"Name: ${lang.name}\\n"`);
}

for (const lang of LANGS) {
  const po = `build/${lang.code}.po`;
  fs.writeFileSync(po, translation(lang));

  for (const pack of PACKS) {
    const dir = `build/pbl_${lang.code}_${pack.name}`;
    const aliases = pack.aliases ? ALIASES[pack.aliases] : {};

    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });

    await $`msgfmt ${po} -o ${dir}/000`;

    pack.slots.forEach((slot, index) => {
      const file = path.join(dir, (index + 1).toString().padStart(3, "0"));
      const font = slot && (aliases[slot] ?? slot);
      if (!font) {
        fs.writeFileSync(file, "");
        return;
      }
      fs.copyFileSync(
        font.startsWith("data/") ? font : `build/${font}.pbf`,
        file,
      );
    });

    await $`bun run ./PebbleFontTool/bin/pbl pack ${dir} -o build/TUMBLED_${lang.code}_${pack.name}.pbl`;
  }
}
