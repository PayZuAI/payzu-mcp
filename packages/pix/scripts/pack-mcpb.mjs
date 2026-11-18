#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { strToU8, zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'mcpb-build');
const bundle = join(outDir, 'payzu-mcp-pix.mcpb');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = readFileSync(join(root, 'mcpb', 'manifest.json'));
const manifestVersion = JSON.parse(manifest.toString('utf8')).version;
if (manifestVersion !== pkg.version) {
  console.error(`mcpb/manifest.json está na versão ${manifestVersion} e package.json na ${pkg.version}`);
  process.exit(1);
}

const { outputFiles } = await build({
  entryPoints: [join(root, 'src', 'index.ts')],
  outfile: join(outDir, 'server', 'index.js'),
  write: false,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  define: { 'import.meta.url': '__IMU' },
  banner: { js: 'const __IMU = require("node:url").pathToFileURL(__filename).href;' },
});

const archive = zipSync(
  {
    'manifest.json': manifest,
    'package.json': strToU8(JSON.stringify({ name: pkg.name, version: pkg.version })),
    'icon.png': readFileSync(join(root, 'assets', 'icon.png')),
    'server/index.js': outputFiles[0].contents,
  },
  { level: 9 },
);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir);
writeFileSync(bundle, archive);
console.log(`${bundle} ${pkg.version} (${archive.length} bytes)`);
