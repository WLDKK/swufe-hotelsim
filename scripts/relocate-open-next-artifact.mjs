import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverRoot = path.join(projectRoot, ".open-next", "server-functions", "default");
const handlerPath = path.join(serverRoot, "handler.mjs");
const normalizedServerRoot = serverRoot.replaceAll("\\", "/");

await access(handlerPath);

const source = await readFile(handlerPath, "utf8");
const absoluteImportPattern = /import\((['"])(\/[^'"]+\/\.open-next\/server-functions\/default\/([^'"]+))\1\)/g;
const targets = [];

const relocated = source.replace(
  absoluteImportPattern,
  (_match, quote, _absolutePath, relativeTarget) => {
    const normalizedTarget = relativeTarget.replaceAll("\\", "/");
    if (normalizedTarget.startsWith("../") || path.isAbsolute(normalizedTarget)) {
      throw new Error(`Unsafe OpenNext import target: ${normalizedTarget}`);
    }

    targets.push(normalizedTarget);
    return `import(${quote}./${normalizedTarget}${quote})`;
  }
);

if (targets.length === 0) {
  throw new Error(
    `No relocatable imports found in ${path.relative(projectRoot, handlerPath)} (expected server root ${normalizedServerRoot}).`
  );
}

for (const target of targets) {
  await access(path.join(serverRoot, target));
}

await writeFile(handlerPath, relocated);
console.log(`Relocated ${targets.length} OpenNext server import(s).`);
