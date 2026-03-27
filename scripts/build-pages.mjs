import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const isWindows = process.platform === 'win32';
const command = isWindows ? 'cmd.exe' : 'npm';
const args = isWindows ? ['/c', 'npm', 'run', 'build'] : ['run', 'build'];

const child = spawn(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    PAGES_DIST: 'true',
  },
});

child.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  // Mantener docs sincronizado con el build para despliegues por rama /docs.
  const rootDir = resolve(process.cwd());
  const distDir = resolve(rootDir, 'dist');
  const docsDir = resolve(rootDir, 'docs');

  if (!existsSync(distDir)) {
    console.error('No se encontro dist despues del build.');
    process.exit(1);
  }

  rmSync(docsDir, { recursive: true, force: true });
  mkdirSync(docsDir, { recursive: true });
  cpSync(distDir, docsDir, { recursive: true, force: true });

  process.exit(0);
});
