import { $ } from "bun";

await $`mkdir -p build/`;
await $`bun run ./bin/pbf build ./fonts/TUMBLED_24 -o build/TUMBLED_24.pbf`;
await $`bun run ./bin/pbf buildbold ./fonts/TUMBLED_24 -o build/TUMBLED_24_BOLD.pbf`;

await $`bun run ./bin/preview build/GOTHIC_24.pbf build/TUMBLED_24.pbf -o images/TUMBLED_24.png`;
await $`bun run ./bin/preview build/GOTHIC_24_BOLD.pbf build/TUMBLED_24_BOLD.pbf -o images/TUMBLED_24_BOLD.png`;