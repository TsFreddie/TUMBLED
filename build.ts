import { $ } from "bun";

await $`mkdir -p build/`;

await $`bun run ./bin/pbf build ./fonts/TUMBLED_14 -o build/TUMBLED_14.pbf`;
await $`bun run ./bin/pbf buildbold ./fonts/TUMBLED_14 -o build/TUMBLED_14_BOLD.pbf`;

await $`bun run ./bin/preview build/GOTHIC_14.pbf build/TUMBLED_14.pbf -o images/TUMBLED_14.png`;
await $`bun run ./bin/preview build/GOTHIC_14_BOLD.pbf build/TUMBLED_14_BOLD.pbf -o images/TUMBLED_14_BOLD.png`;

await $`bun run ./bin/pbf build ./fonts/TUMBLED_18 -o build/TUMBLED_18.pbf`;
await $`bun run ./bin/pbf buildbold ./fonts/TUMBLED_18 -o build/TUMBLED_18_BOLD.pbf`;

await $`bun run ./bin/preview build/GOTHIC_18.pbf build/TUMBLED_18.pbf -o images/TUMBLED_18.png`;
await $`bun run ./bin/preview build/GOTHIC_18_BOLD.pbf build/TUMBLED_18_BOLD.pbf -o images/TUMBLED_18_BOLD.png`;

await $`bun run ./bin/pbf build ./fonts/TUMBLED_24 -o build/TUMBLED_24.pbf`;
await $`bun run ./bin/pbf buildbold ./fonts/TUMBLED_24 -o build/TUMBLED_24_BOLD.pbf`;

await $`bun run ./bin/preview build/GOTHIC_24.pbf build/TUMBLED_24.pbf -o images/TUMBLED_24.png`;
await $`bun run ./bin/preview build/GOTHIC_24_BOLD.pbf build/TUMBLED_24_BOLD.pbf -o images/TUMBLED_24_BOLD.png`;

await $`bun run ./bin/pbf build ./fonts/TUMBLED_28 -o build/TUMBLED_28.pbf`;
await $`bun run ./bin/pbf buildbold ./fonts/TUMBLED_28 -o build/TUMBLED_28_BOLD.pbf`;

await $`bun run ./bin/preview build/GOTHIC_28.pbf build/TUMBLED_28.pbf -o images/TUMBLED_28.png`;
await $`bun run ./bin/preview build/GOTHIC_28_BOLD.pbf build/TUMBLED_28_BOLD.pbf -o images/TUMBLED_28_BOLD.png`;
