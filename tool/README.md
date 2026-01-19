# Tumbled Font Editor

This is a font editor specifically designed for tumbled fonts.

## Usage

Before running this tool. You need to generate the reference Unifont font first:

In the root directory of the tumbled project, run:

```bash
bun install
bun run ./scripts/combine.ts
bun run ./scripts/extract_unifont.ts
```

To run the tool:

```bash
cd tool
bun install
bun --bun run dev
```
