import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const docsDir = path.join(root, "docs");
const distAssetsDir = path.join(distDir, "assets");
const docsAssetsDir = path.join(docsDir, "assets");

await mkdir(docsDir, { recursive: true });
await rm(docsAssetsDir, { recursive: true, force: true });
await mkdir(docsAssetsDir, { recursive: true });

await cp(path.join(distDir, "index.html"), path.join(docsDir, "index.html"));
await cp(path.join(distDir, ".nojekyll"), path.join(docsDir, ".nojekyll"));
await cp(path.join(distAssetsDir, "runtime"), path.join(docsAssetsDir, "runtime"), { recursive: true });

const assetEntries = await readdir(distAssetsDir, { withFileTypes: true });
await Promise.all(assetEntries
  .filter((entry) => entry.isFile() && /\.(css|js)$/.test(entry.name))
  .map((entry) => cp(path.join(distAssetsDir, entry.name), path.join(docsAssetsDir, entry.name))));
