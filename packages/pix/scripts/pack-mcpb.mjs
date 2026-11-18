#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'mcpb-build');
const stage = join(outDir, 'stage');
const bundle = join(outDir, 'payzu-mcp-pix.mcpb');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'mcpb', 'manifest.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  console.error(`mcpb/manifest.json está na versão ${manifest.version} e package.json na ${pkg.version}`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(stage, 'server'), { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'index.ts')],
  outfile: join(stage, 'server', 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  define: { 'import.meta.url': '__IMU' },
  banner: { js: 'const __IMU = require("node:url").pathToFileURL(__filename).href;' },
});

writeFileSync(join(stage, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version }));
cpSync(join(root, 'mcpb', 'manifest.json'), join(stage, 'manifest.json'));
cpSync(join(root, 'assets', 'icon.png'), join(stage, 'icon.png'));

execFileSync('mcpb', ['pack', stage, bundle], { stdio: 'inherit' });
