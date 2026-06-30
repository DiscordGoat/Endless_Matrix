import { cp, mkdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";

const distDir = "dist";
const fallbackDir = join(distDir, "dist");

await rm(fallbackDir, { recursive: true, force: true });
await mkdir(fallbackDir, { recursive: true });
await copyFile(join(distDir, "index.html"), join(fallbackDir, "index.html"));
await cp(join(distDir, "assets"), join(fallbackDir, "assets"), { recursive: true });
