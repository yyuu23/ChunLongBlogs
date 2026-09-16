import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const noticePath = join(root, "THIRD_PARTY_NOTICES.md");
const notice = readFileSync(noticePath, "utf8");
const managedRoots = [
  "public/sounds/ambient",
  "public/sounds/fireworks",
  "public/textures/planets",
  "public/assets/logos",
  "public/music",
];

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const failures = [];
for (const managedRoot of managedRoots) {
  const absolute = join(root, managedRoot);
  if (!statSync(absolute).isDirectory()) {
    failures.push(`missing managed directory: ${managedRoot}`);
    continue;
  }
  for (const file of filesUnder(absolute)) {
    if (/CREDITS\.md$/i.test(file)) continue;
    const path = relative(root, file).split(sep).join("/");
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (!notice.includes(`\`${path}\``)) failures.push(`missing path in notices: ${path}`);
    if (!notice.includes(`\`${hash}\``)) failures.push(`missing/current hash mismatch: ${path}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log("asset notices: all managed files and hashes are recorded");
}
