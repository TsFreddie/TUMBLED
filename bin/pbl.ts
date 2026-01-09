import { ResourcePack } from "../lib/pbl";
import { parseArgs } from "util";
import fs from "fs";
import path from "path";

try {
  const { values, positionals } = parseArgs({
    args: process.argv,
    options: {
      system: {
        type: "boolean",
      },
      out: {
        type: "string",
        short: "o",
        default: "///",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  const operation = positionals[2];

  if (operation === "unpack") {
    const file = positionals[3];
    if (!file) {
      console.error("No file specified");
      process.exit(1);
    }

    const result = ResourcePack.deserialize(
      fs.readFileSync(file),
      !!values.system,
    );

    let out = values.out;
    if (out === "///") {
      out = file + "_unpack";
    }

    const dirname = path.resolve(out);
    fs.mkdirSync(dirname, { recursive: true });

    for (let i = 0; i < result.tableEntries.length; i++) {
      const entry = result.tableEntries[i]!;
      const content = result.contents[entry.contentIndex]!;
      fs.writeFileSync(
        path.join(dirname, `${i.toString().padStart(3, "0")}`),
        content,
      );
    }

    console.log("Unpacked " + result.tableEntries.length + " files");
    process.exit(0);
  }

  if (operation === "pack") {
    const dir = positionals[3];
    if (!dir) {
      console.error("No directory specified");
      process.exit(1);
    }

    const dirname = path.resolve(dir);
    const files = fs.readdirSync(dirname);

    const pack = new ResourcePack(values.system ? true : false);
    for (const file of files.sort()) {
      const content = fs.readFileSync(path.join(dirname, file));
      pack.addResource(content);
    }

    let out = values.out;
    if (out === "///") {
      out = dirname + ".pbl";
    }

    const outfileName = path.resolve(out);
    const buffer = pack.serialize();
    fs.writeFileSync(outfileName, buffer);

    console.log("Packed " + files.length + " files");
    process.exit(0);
  }

  console.error("Unknown operation: " + operation);
  process.exit(1);
} catch (err: any) {
  console.error(err?.message || err);
  process.exit(1);
}
