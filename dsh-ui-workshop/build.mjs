/**
 * dsh-ui-workshop build.
 *
 * Both halves are plain JavaScript, so this script has no dependencies. It
 * inlines the package name and version, then writes the two files `package.json`
 * exports.
 *
 *   node build.mjs
 *
 * The browser artifact is wrapped in the module-loader envelope DSH's client
 * module system serves: `factory(require) -> exports`. A bundle that leaves an
 * `export` statement in place would be a classic script with ESM-only syntax and
 * never reach the loader.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (relative) => readFile(join(root, relative), 'utf8');

const pkg = JSON.parse(await read('package.json'));
const [host, client, thinkArt] = await Promise.all([
  read('src/host.js'),
  read('src/client.js'),
  /* The artwork table is generated and large; it is inlined into the browser half. */
  read('src/think-art.js'),
]);

const banner = (half) =>
  `/* ${pkg.name} v${pkg.version} — generated ${half}. Edit src/ and run "node build.mjs". */\n`;

/** Constants both halves read; injected where the sources use them. */
const consts =
  `const PACKAGE_NAME = ${JSON.stringify(pkg.name)};\n`
  + `const PLUGIN_VERSION = ${JSON.stringify(pkg.version)};\n`;

/**
 * Translate the browser source's ESM surface into the factory-form CJS the client
 * module loader materializes.
 *
 * Handles both `import { a, b } from 'x'` and `import X from 'x'`, including the
 * `a as b` alias, and rewrites a trailing `export { ... };` into `exports.*`.
 *
 * @param source - `src/client.js` text.
 * @returns the factory body: `require` bindings plus the source without its
 *   `import`/`export` statements.
 */
function toFactoryBody(source) {
  /** specifier -> { named: string[], defaults: string[] } */
  const imports = new Map();
  const bucket = (specifier) => {
    if (!imports.has(specifier)) imports.set(specifier, { named: [], defaults: [] });
    return imports.get(specifier);
  };
  let body = source.replace(
    /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';$/gm,
    (match, names, specifier) => {
      const target = bucket(specifier);
      for (const name of names.split(',').map((entry) => entry.trim()).filter(Boolean)) {
        /* `a as b` has no CJS form; destructuring writes it as `a: b`. */
        const alias = /^(\w+)\s+as\s+(\w+)$/.exec(name);
        target.named.push(alias === null ? name : `${alias[1]}: ${alias[2]}`);
      }
      return '';
    },
  );
  body = body.replace(
    /^import\s+(\w+)\s+from\s*'([^']+)';$/gm,
    (match, local, specifier) => {
      bucket(specifier).defaults.push(local);
      return '';
    },
  );
  const requireLines = [...imports.entries()].flatMap(([specifier, entry]) => {
    const lines = [];
    if (entry.named.length > 0) {
      lines.push(`const { ${entry.named.join(', ')} } = require(${JSON.stringify(specifier)});`);
    }
    for (const local of entry.defaults) {
      lines.push(`const ${local} = require(${JSON.stringify(specifier)});`);
    }
    return lines;
  });
  const withoutExports = body.replace(
    /^export\s*\{([^}]*)\};$/m,
    (match, names) => names.split(',').map((name) => name.trim()).filter(Boolean)
      .map((name) => `exports.${name} = ${name};`)
      .join('\n'),
  );
  return `\t\t${requireLines.join('\n\t\t')}\n${withoutExports}`;
}

/* The Host half is an ordinary ES module: constants + Host body. */
const hostArtifact = `${banner('Host half')}${consts}\n${host}`;

/* The browser half only registers a factory; the loader materializes it later. */
const clientArtifact = `${banner('browser half')}window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${consts}${thinkArt}
${toFactoryBody(client)}
\t\treturn module.exports;
\t}
});
`;

await mkdir(join(root, 'lib'), { recursive: true });
await writeFile(join(root, 'lib', 'index.js'), hostArtifact, 'utf8');
await writeFile(join(root, 'lib', 'client.js'), clientArtifact, 'utf8');

process.stdout.write(
  `${pkg.name}: wrote lib/index.js, lib/client.js — ${hostArtifact.length} + ${clientArtifact.length} characters\n`,
);
