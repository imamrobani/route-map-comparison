const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();

const walk = (dirPath) => {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".swift")) {
      results.push(fullPath);
    }
  }

  return results;
};

const patchFile = (filePath) => {
  const original = fs.readFileSync(filePath, "utf8");
  const lines = original.split(/\r?\n/);

  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const previousLine = out.length > 0 ? out[out.length - 1] : "";

    const isPreviewStart = trimmed.startsWith("#Preview");
    const alreadyWrapped =
      previousLine.trim() === "#if canImport(PreviewsMacros)";

    if (!isPreviewStart || alreadyWrapped) {
      out.push(line);
      continue;
    }

    out.push("#if canImport(PreviewsMacros)");
    out.push(line);

    let braceDepth = 0;
    for (const ch of line) {
      if (ch === "{") braceDepth++;
      if (ch === "}") braceDepth--;
    }

    while (braceDepth > 0 && i + 1 < lines.length) {
      i++;
      const nextLine = lines[i];
      out.push(nextLine);
      for (const ch of nextLine) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
    }

    out.push("#endif");
  }

  const updated = out.join("\n");
  if (updated !== original) {
    fs.writeFileSync(filePath, updated);
  }
};

const packageIosDirs = [
  path.join(projectRoot, "node_modules", "expo-dev-menu", "ios"),
  path.join(projectRoot, "node_modules", "expo-dev-launcher", "ios"),
];

for (const iosDir of packageIosDirs) {
  for (const filePath of walk(iosDir)) {
    const source = fs.readFileSync(filePath, "utf8");
    if (!source.includes("#Preview")) continue;
    patchFile(filePath);
  }
}
