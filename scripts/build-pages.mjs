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
    PAGES_BASE_PATH: process.env.PAGES_BASE_PATH || '/',
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
  const docsBackupDir = resolve(rootDir, '.tmp_docs_backup');

  if (!existsSync(distDir)) {
    console.error('No se encontro dist despues del build.');
    process.exit(1);
  }

  // Preservar artefactos de APK/versión para no romper el flujo de actualización
  // cuando se publica solo web (sync:online).
  const preservar = ['celiashop-android.apk', 'celiashop.apk', 'apk-version.json', 'CNAME'];
  rmSync(docsBackupDir, { recursive: true, force: true });
  mkdirSync(docsBackupDir, { recursive: true });

  for (const nombre of preservar) {
    const origen = resolve(docsDir, nombre);
    if (existsSync(origen)) {
      cpSync(origen, resolve(docsBackupDir, nombre), { force: true });
    }
  }

  rmSync(docsDir, { recursive: true, force: true });
  mkdirSync(docsDir, { recursive: true });
  cpSync(distDir, docsDir, { recursive: true, force: true });

  for (const nombre of preservar) {
    const respaldo = resolve(docsBackupDir, nombre);
    if (existsSync(respaldo)) {
      cpSync(respaldo, resolve(docsDir, nombre), { force: true });
    }
  }

  rmSync(docsBackupDir, { recursive: true, force: true });

  process.exit(0);
});
