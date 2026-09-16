import { $ } from "bun";
import fs from "fs";
import path from "path";

// Written into every pack's translation header.
const VERSION = "1.11";

// Language packs to build. A `po` entry is a vendored catalog from
// coredevices/pebbleos-translations (see locale/README.md). Older PBF-only
// packs carry no catalog at all, so the system keeps its built-in English
// strings while still rendering CJK with the TUMBLED fonts.
const LANGS = [
  { code: "en_CN", name: "English + TUMBLED" },
  { code: "zh_CN", name: "简体中文 + TUMBLED", po: "locale/zh_CN.po" },
];

// Font slots of each watch, in resource order. The built-in display fonts
// (BITHAM_*, ROBOTO_*, DROID_SERIF_28_BOLD) get the closest existing CJK
// font so Chinese renders there at the right size; the pack dedupes the
// bytes, so pointing a slot at a font the pack already carries adds nothing
// to the file. The base/extension pair is only aligned when the two PBF
// heights match, so the closest size is picked per slot:
//   BITHAM_18_LIGHT_SUBSET (18) -> 18
//   BITHAM_30_BLACK        (30) -> 28_BOLD
//   BITHAM_34_*            (34) -> 36 / 28, MEDIUM_NUMBERS 28_BOLD
//   BITHAM_42_*            (42) -> 36 / 28, BOLD 36_BOLD / 28_BOLD
//   ROBOTO_CONDENSED_21    (21) -> 18_BOLD
//   ROBOTO_BOLD_SUBSET_49  (49) -> 36_BOLD / 28_BOLD
//   DROID_SERIF_28_BOLD    (28) -> 28_BOLD
// (36/36_BOLD exist on PT2 only; P2D tops out at 28.)
//
// The pack's resources are addressed by position: the firmware's `lang` file is
// STRINGS followed by twenty font slots, in the order of
// `resources/normal/base/resource_map.json` (which gained
// GOTHIC_36_EXTENDED/GOTHIC_36_BOLD_EXTENDED in PebbleOS e61256bb6, 36 px
// non-Latin text for the notification card's Larger size). Both lists below
// must therefore stay twenty entries long.
const P2D_SLOTS = [
  "TUMBLED_14",            // GOTHIC_14_EXTENDED
  "TUMBLED_14_BOLD",       // GOTHIC_14_BOLD_EXTENDED
  "TUMBLED_18",            // GOTHIC_18_EXTENDED
  "TUMBLED_18_BOLD",       // GOTHIC_18_BOLD_EXTENDED
  "TUMBLED_24",            // GOTHIC_24_EXTENDED
  "TUMBLED_24_BOLD",       // GOTHIC_24_BOLD_EXTENDED
  "TUMBLED_28",            // GOTHIC_28_EXTENDED
  "TUMBLED_28_BOLD",       // GOTHIC_28_BOLD_EXTENDED
  "TUMBLED_28",            // GOTHIC_36_EXTENDED (no 36 px font here: use the largest)
  "TUMBLED_28_BOLD",       // GOTHIC_36_BOLD_EXTENDED
  "TUMBLED_18",            // BITHAM_18_LIGHT_SUBSET (18)
  "TUMBLED_28_BOLD",       // BITHAM_30_BLACK (30)
  "TUMBLED_28",            // BITHAM_34_LIGHT_SUBSET (34)
  "TUMBLED_28_BOLD",       // BITHAM_34_MEDIUM_NUMBERS (34)
  "TUMBLED_28_BOLD",       // BITHAM_42_BOLD (42)
  "TUMBLED_28",            // BITHAM_42_LIGHT (42)
  "TUMBLED_28_BOLD",       // BITHAM_42_MEDIUM_NUMBERS (42)
  "TUMBLED_18_BOLD",       // ROBOTO_CONDENSED_21 (21)
  "TUMBLED_28_BOLD",       // ROBOTO_BOLD_SUBSET_49 (49)
  "TUMBLED_28_BOLD",       // DROID_SERIF_28_BOLD (28)
];

const PT2_SLOTS = [
  "TUMBLED_14",            // GOTHIC_14_EXTENDED
  "TUMBLED_14_BOLD",       // GOTHIC_14_BOLD_EXTENDED
  "TUMBLED_18",            // GOTHIC_18_EXTENDED
  "TUMBLED_18_BOLD",       // GOTHIC_18_BOLD_EXTENDED
  "TUMBLED_24",            // GOTHIC_24_EXTENDED
  "TUMBLED_24_BOLD",       // GOTHIC_24_BOLD_EXTENDED
  "TUMBLED_28",            // GOTHIC_28_EXTENDED
  "TUMBLED_28_BOLD",       // GOTHIC_28_BOLD_EXTENDED
  "TUMBLED_36",            // GOTHIC_36_EXTENDED
  "TUMBLED_36_BOLD",       // GOTHIC_36_BOLD_EXTENDED
  "TUMBLED_18",            // BITHAM_18_LIGHT_SUBSET (18)
  "TUMBLED_28_BOLD",       // BITHAM_30_BLACK (30)
  "TUMBLED_36",            // BITHAM_34_LIGHT_SUBSET (34)
  "TUMBLED_28_BOLD",       // BITHAM_34_MEDIUM_NUMBERS (34)
  "TUMBLED_36_BOLD",       // BITHAM_42_BOLD (42)
  "TUMBLED_36",            // BITHAM_42_LIGHT (42)
  "TUMBLED_36_BOLD",       // BITHAM_42_MEDIUM_NUMBERS (42)
  "TUMBLED_18_BOLD",       // ROBOTO_CONDENSED_21 (21)
  "TUMBLED_36_BOLD",       // ROBOTO_BOLD_SUBSET_49 (49)
  "TUMBLED_28_BOLD",       // DROID_SERIF_28_BOLD (28)
];

// A silent off-by-one here shifts every font after it: the firmware maps the
// pack's resources to its slots by position.
const LANG_FONT_SLOTS = 20;
for (const [name, slots] of [["P2D", P2D_SLOTS], ["PT2", PT2_SLOTS]]) {
  if (slots.length !== LANG_FONT_SLOTS) {
    throw new Error(
      `${name} slot list has ${slots.length} fonts, expected ${LANG_FONT_SLOTS} ` +
        `(the firmware's lang resource list)`,
    );
  }
}
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

// `--v4` emits the sorted-index v4 fonts (and therefore v4 packs);
// `--no-arith` keeps the v4 index but falls back to RAW/RLE4; `--suffix=_v4`
// names the outputs separately so a v3 pack set stays next to the new one.
const v4 = process.argv.includes("--v4");
const noArith = process.argv.includes("--no-arith");
const suffixArg = process.argv.find((arg) => arg.startsWith("--suffix="));
const suffix = suffixArg ? suffixArg.slice("--suffix=".length) : "";
const PBF_FLAGS = [...(v4 ? ["--v4"] : []), ...(noArith ? ["--no-arith"] : [])];

// Preview images are drawn on the same gray as the README's specimen sheet.
const PREVIEW_BG = "#cccccc";

fs.mkdirSync("build/", { recursive: true });

// The fonts are language independent, so build them once.

for (const size of SIZES) {
  await $`bun run ./PebbleFontTool/bin/pbf build ./fonts/TUMBLED_${size} -o build/TUMBLED_${size}${suffix}.pbf ${PBF_FLAGS}`;
  await $`bun run ./PebbleFontTool/bin/pbf buildbold ./fonts/TUMBLED_${size} -o build/TUMBLED_${size}_BOLD${suffix}.pbf ${BOLD_FLAGS[size] ?? []} ${PBF_FLAGS}`;

  if (!skipPreviews && !suffix) {
    await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_${size}.pbf build/TUMBLED_${size}.pbf -o images/TUMBLED_${size}.png -w 200 -h 228 -l ${size} --bg ${PREVIEW_BG}`;
    await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_${size}_BOLD.pbf build/TUMBLED_${size}_BOLD.pbf -o images/TUMBLED_${size}_BOLD.png -w 200 -h 228 -l ${size} --bg ${PREVIEW_BG}`;
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
        font.startsWith("data/") ? font : `build/${font}${suffix}.pbf`,
        file,
      );
    });

    await $`bun run ./PebbleFontTool/bin/pbl pack ${dir} -o build/TUMBLED_${lang.code}_${pack.name}${suffix}.pbl`;
  }
}
