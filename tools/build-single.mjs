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
const setVersionIndex = args.indexOf("--set-version");
const setVersion = setVersionIndex >= 0 ? args[setVersionIndex + 1] : null;
const autoBump = args.includes("--auto-bump");
const syncVersion = args.includes("--sync-version");
const overwrite = args.includes("--overwrite");
const printVersion = args.includes("--print-version");
const help = args.includes("--help");

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

const parseCliVersion = (raw) => parseVersion(raw);

const getOutPath = (version) => path.join(distDir, `2048lite-${version}.html`);

const findNextAvailableVersion = (version) => {
  let next = { ...version };
  while (fs.existsSync(getOutPath(formatVersion(next)))) {
    next = bumpVersion(next, "patch");
  }
  return next;
};

const writeVersionFile = (version) => {
  writeText(versionPath, `${formatVersion(version)}\n`);
};

const printHelp = () => {
  console.log(`Usage: node tools/build-single.mjs [options]

Options:
  --bump <patch|minor|major>  Increment VERSION before building
  --set-version <x.y.z>       Set VERSION explicitly before building
  --auto-bump                 If target output exists, bump patch until a free version is found
  --sync-version              Write the auto-selected version back to VERSION
  --overwrite                 Overwrite an existing dist file for the selected version
  --print-version             Print the resolved version and exit
  --help                      Show this help
`);
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
  if (help) {
    printHelp();
    return;
  }

  if (bumpIndex >= 0 && !bump) {
    throw new Error("Missing value for --bump. Use patch|minor|major");
  }

  if (setVersionIndex >= 0 && !setVersion) {
    throw new Error("Missing value for --set-version. Use x.y.z");
  }

  if (bump && setVersion) {
    throw new Error("Use either --bump or --set-version, not both");
  }

  const rawVersion = readText(versionPath);
  let current = parseVersion(rawVersion);

  if (setVersion) {
    current = parseCliVersion(setVersion);
    writeVersionFile(current);
  } else if (bump) {
    current = bumpVersion(current, bump);
    writeVersionFile(current);
  }

  if (autoBump) {
    const available = findNextAvailableVersion(current);
    const changed = formatVersion(available) !== formatVersion(current);
    current = available;
    if (changed && syncVersion) {
      writeVersionFile(current);
    }
  }

  const version = formatVersion(current);

  if (printVersion) {
    console.log(version);
    return;
  }

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
  const outPath = getOutPath(version);
  if (fs.existsSync(outPath) && !overwrite) {
    throw new Error(`Output already exists: ${outPath}`);
  }
  writeText(outPath, output);
  console.log(`Built ${outPath} (version ${version})`);
};

main();
