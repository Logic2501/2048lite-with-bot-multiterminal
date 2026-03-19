import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());
const versionPath = path.join(root, "VERSION");
const indexPath = path.join(root, "index.html");
const stylePath = path.join(root, "src", "style.css");
const entryPath = path.join(root, "src", "main.js");
const distDir = path.join(root, "dist");

const args = process.argv.slice(2);
const bumpIndex = args.indexOf("--bump");
const bump = bumpIndex >= 0 ? args[bumpIndex + 1] : null;

const readText = (file) => fs.readFileSync(file, "utf8");
const writeText = (file, content) => fs.writeFileSync(file, content, "utf8");

const parseVersion = (raw) => {
  const match = raw.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error("VERSION must be semver: x.y.z");
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
};

const formatVersion = (v) => `${v.major}.${v.minor}.${v.patch}`;

const bumpVersion = (v, kind) => {
  if (kind === "major") return { major: v.major + 1, minor: 0, patch: 0 };
  if (kind === "minor") return { major: v.major, minor: v.minor + 1, patch: 0 };
  if (kind === "patch") return { major: v.major, minor: v.minor, patch: v.patch + 1 };
  throw new Error("Unknown bump type. Use patch|minor|major");
};

const resolveModule = (base, spec) => {
  if (!spec.startsWith(".")) {
    throw new Error(`Only relative imports are supported in build: ${spec}`);
  }
  const resolved = path.resolve(path.dirname(base), spec);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  if (fs.existsSync(`${resolved}.js`)) return `${resolved}.js`;
  if (fs.existsSync(path.join(resolved, "index.js"))) return path.join(resolved, "index.js");
  throw new Error(`Cannot resolve import: ${spec} from ${base}`);
};

const parseImports = (code) => {
  const imports = [];
  const importRegex = /import\s+[^"']*["']([^"']+)["']\s*;?/g;
  let match;
  while ((match = importRegex.exec(code))) {
    imports.push(match[1]);
  }
  return imports;
};

const stripImports = (code) => code.replace(/import\s+[^;]+;?/g, "");

const stripExports = (code) => {
  let out = code;
  out = out.replace(/export\s+(const|let|var|function|class)\s+/g, "$1 ");
  out = out.replace(/export\s*\{[^}]*\}\s*;?/g, "");
  return out;
};

const buildModuleGraph = (entry) => {
  const visited = new Set();
  const ordered = [];

  const visit = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    const code = readText(file);
    const imports = parseImports(code);
    imports.forEach((spec) => visit(resolveModule(file, spec)));
    ordered.push(file);
  };

  visit(entry);
  return ordered;
};

const bundleJS = (entry) => {
  const modules = buildModuleGraph(entry);
  const parts = modules.map((file) => {
    const raw = readText(file);
    const stripped = stripExports(stripImports(raw));
    return `\n// ${path.relative(root, file)}\n${stripped}\n`;
  });
  return `(function(){\n${parts.join("\n")}\n})();`;
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const main = () => {
  const rawVersion = readText(versionPath);
  let current = parseVersion(rawVersion);
  if (bump) {
    current = bumpVersion(current, bump);
    writeText(versionPath, formatVersion(current) + "\n");
  }
  const version = formatVersion(current);

  const html = readText(indexPath);
  const css = readText(stylePath);
  const js = bundleJS(entryPath);

  let output = html;
  output = output.replace(
    /<link\s+rel=["']stylesheet["']\s+href=["']\.\/src\/style\.css["']\s*\/>/i,
    `<style>\n${css}\n</style>`
  );
  output = output.replace(
    /<script\s+type=["']module["']\s+src=["']\.\/src\/main\.js["']\s*><\/script>/i,
    `<script>\n${js}\n</script>`
  );

  if (/<meta\s+name=["']app-version["']/.test(output)) {
    output = output.replace(
      /<meta\s+name=["']app-version["']\s+content=["'][^"']*["']\s*\/>/i,
      `<meta name="app-version" content="${version}" />`
    );
  } else {
    output = output.replace(
      /<head>/i,
      `<head>\n    <meta name="app-version" content="${version}" />`
    );
  }

  ensureDir(distDir);
  const outPath = path.join(distDir, `2048lite-${version}.html`);
  if (fs.existsSync(outPath)) {
    throw new Error(`Output already exists: ${outPath}`);
  }
  writeText(outPath, output);
  console.log(`Built ${outPath} (version ${version})`);
};

main();
