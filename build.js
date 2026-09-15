import { $ } from "bun";
import fs from 'fs';

const VERSION = "1.5";
const LANGUAGE = "en_CN";
const NAME = "English + TUMBLED";

const skipPreviews = process.argv.includes("--skip-previews");

await $`mkdir -p build/`;

fs.writeFileSync("build/000.po", `msgid ""
msgstr ""
"Project-Id-Version: ${VERSION}\\n"
"Language: ${LANGUAGE}\\n"
"Name: ${NAME}\\n"
"Content-Type: text/plain; charset=utf-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
`);

await $`mkdir -p build/TUMBLED_PBL`;

await $`bun run ./PebbleFontTool/bin/pbf build ./fonts/TUMBLED_14 -o build/TUMBLED_14.pbf`;
await $`bun run ./PebbleFontTool/bin/pbf buildbold ./fonts/TUMBLED_14 -o build/TUMBLED_14_BOLD.pbf`;

if (!skipPreviews) {
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_14.pbf build/TUMBLED_14.pbf -o images/TUMBLED_14.png -w 200 -h 228 -l 14`;
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_14_BOLD.pbf build/TUMBLED_14_BOLD.pbf -o images/TUMBLED_14_BOLD.png -w 200 -h 228 -l 14`;
}

await $`bun run ./PebbleFontTool/bin/pbf build ./fonts/TUMBLED_18 -o build/TUMBLED_18.pbf`;
await $`bun run ./PebbleFontTool/bin/pbf buildbold ./fonts/TUMBLED_18 -o build/TUMBLED_18_BOLD.pbf`;

if (!skipPreviews) {
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_18.pbf build/TUMBLED_18.pbf -o images/TUMBLED_18.png -w 200 -h 228 -l 18`;
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_18_BOLD.pbf build/TUMBLED_18_BOLD.pbf -o images/TUMBLED_18_BOLD.png -w 200 -h 228 -l 18`;
}

await $`bun run ./PebbleFontTool/bin/pbf build ./fonts/TUMBLED_24 -o build/TUMBLED_24.pbf`;
await $`bun run ./PebbleFontTool/bin/pbf buildbold ./fonts/TUMBLED_24 -o build/TUMBLED_24_BOLD.pbf`;

if (!skipPreviews) {
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_24.pbf build/TUMBLED_24.pbf -o images/TUMBLED_24.png -w 200 -h 228 -l 24`;
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_24_BOLD.pbf build/TUMBLED_24_BOLD.pbf -o images/TUMBLED_24_BOLD.png -w 200 -h 228 -l 24`;
}

await $`bun run ./PebbleFontTool/bin/pbf build ./fonts/TUMBLED_28 -o build/TUMBLED_28.pbf`;
await $`bun run ./PebbleFontTool/bin/pbf buildbold ./fonts/TUMBLED_28 -o build/TUMBLED_28_BOLD.pbf`;

if (!skipPreviews) {
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_28.pbf build/TUMBLED_28.pbf -o images/TUMBLED_28.png -w 200 -h 228 -l 28`;
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_28_BOLD.pbf build/TUMBLED_28_BOLD.pbf -o images/TUMBLED_28_BOLD.png -w 200 -h 228 -l 28`;
}

await $`bun run ./PebbleFontTool/bin/pbf build ./fonts/TUMBLED_36 -o build/TUMBLED_36.pbf`;
await $`bun run ./PebbleFontTool/bin/pbf buildbold ./fonts/TUMBLED_36 -o build/TUMBLED_36_BOLD.pbf`;

if (!skipPreviews) {
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_36.pbf build/TUMBLED_36.pbf -o images/TUMBLED_36.png -w 200 -h 228 -l 36`;
  await $`bun run ./PebbleFontTool/bin/preview build/GOTHIC_36_BOLD.pbf build/TUMBLED_36_BOLD.pbf -o images/TUMBLED_36_BOLD.png -w 200 -h 228 -l 36`;
}


await $`msgfmt build/000.po -o build/TUMBLED_PBL/000`
await $`cp build/TUMBLED_14.pbf build/TUMBLED_PBL/001`;
await $`cp build/TUMBLED_14_BOLD.pbf build/TUMBLED_PBL/002`;
await $`cp build/TUMBLED_18.pbf build/TUMBLED_PBL/003`;
await $`cp build/TUMBLED_18_BOLD.pbf build/TUMBLED_PBL/004`;
await $`cp build/TUMBLED_24.pbf build/TUMBLED_PBL/005`;
await $`cp build/TUMBLED_24_BOLD.pbf build/TUMBLED_PBL/006`;
await $`cp build/TUMBLED_28.pbf build/TUMBLED_PBL/007`;
await $`cp build/TUMBLED_28_BOLD.pbf build/TUMBLED_PBL/008`;
await $`touch build/TUMBLED_PBL/009`;
await $`touch build/TUMBLED_PBL/010`;
await $`touch build/TUMBLED_PBL/011`;
await $`touch build/TUMBLED_PBL/012`;
await $`touch build/TUMBLED_PBL/013`;
await $`touch build/TUMBLED_PBL/014`;
await $`touch build/TUMBLED_PBL/015`;
await $`cp data/016 build/TUMBLED_PBL/016`;
await $`touch build/TUMBLED_PBL/017`;
await $`touch build/TUMBLED_PBL/018`;

await $`bun run ./PebbleFontTool/bin/pbl pack build/TUMBLED_PBL -o build/TUMBLED_P2D.pbl`;

await $`cp -f build/TUMBLED_PBL/001 build/TUMBLED_PBL/002`;
await $`cp -f build/TUMBLED_PBL/006 build/TUMBLED_PBL/005`;
await $`cp -f build/TUMBLED_PBL/007 build/TUMBLED_PBL/008`;

await $`bun run ./PebbleFontTool/bin/pbl pack build/TUMBLED_PBL -o build/TUMBLED_LITE_P2D.pbl`;

// Pebble Time 2 (Emery): 21 slot layout, with the GOTHIC_36 extended slots.
await $`mkdir -p build/TUMBLED_PT2_PBL`;

await $`msgfmt build/000.po -o build/TUMBLED_PT2_PBL/000`
await $`cp build/TUMBLED_14.pbf build/TUMBLED_PT2_PBL/001`;
await $`cp build/TUMBLED_14_BOLD.pbf build/TUMBLED_PT2_PBL/002`;
await $`cp build/TUMBLED_18.pbf build/TUMBLED_PT2_PBL/003`;
await $`cp build/TUMBLED_18_BOLD.pbf build/TUMBLED_PT2_PBL/004`;
await $`cp build/TUMBLED_24.pbf build/TUMBLED_PT2_PBL/005`;
await $`cp build/TUMBLED_24_BOLD.pbf build/TUMBLED_PT2_PBL/006`;
await $`cp build/TUMBLED_28.pbf build/TUMBLED_PT2_PBL/007`;
await $`cp build/TUMBLED_28_BOLD.pbf build/TUMBLED_PT2_PBL/008`;
await $`cp build/TUMBLED_36.pbf build/TUMBLED_PT2_PBL/009`;
await $`cp build/TUMBLED_36_BOLD.pbf build/TUMBLED_PT2_PBL/010`;
await $`touch build/TUMBLED_PT2_PBL/011`;
await $`touch build/TUMBLED_PT2_PBL/012`;
await $`touch build/TUMBLED_PT2_PBL/013`;
await $`touch build/TUMBLED_PT2_PBL/014`;
await $`touch build/TUMBLED_PT2_PBL/015`;
await $`touch build/TUMBLED_PT2_PBL/016`;
await $`touch build/TUMBLED_PT2_PBL/017`;
await $`cp data/016 build/TUMBLED_PT2_PBL/018`;
await $`touch build/TUMBLED_PT2_PBL/019`;
await $`touch build/TUMBLED_PT2_PBL/020`;

await $`bun run ./PebbleFontTool/bin/pbl pack build/TUMBLED_PT2_PBL -o build/TUMBLED_PT2.pbl`;

// Emery's notifications at the default (Large) content size use GOTHIC_18,
// 24, 24_BOLD, 28 and 28_BOLD. LITE keeps every notification face distinct
// and only aliases the ones notifications never reach (14_BOLD) plus the
// ExtraLarge-only 36_BOLD. MINI additionally aliases 18_BOLD, which only
// the Medium content size uses; the remaining slots alias to the closest
// same-size design so every size still has CJK coverage.
await $`cp -f build/TUMBLED_PT2_PBL/001 build/TUMBLED_PT2_PBL/002`;
await $`cp -f build/TUMBLED_PT2_PBL/009 build/TUMBLED_PT2_PBL/010`;

await $`bun run ./PebbleFontTool/bin/pbl pack build/TUMBLED_PT2_PBL -o build/TUMBLED_LITE_PT2.pbl`;

await $`cp -f build/TUMBLED_PT2_PBL/003 build/TUMBLED_PT2_PBL/004`;

await $`bun run ./PebbleFontTool/bin/pbl pack build/TUMBLED_PT2_PBL -o build/TUMBLED_MINI_PT2.pbl`;