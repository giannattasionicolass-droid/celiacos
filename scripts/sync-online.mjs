import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const userMessage = process.argv.slice(2).join(' ').trim();
const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
const commitMessage = userMessage || `sync: online update ${timestamp}`;

const run = (cmd, args, allowFailure = false) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });

  if (result.error) {
    console.error(`Error ejecutando ${cmd}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status || 1);
  }

  return result.status || 0;
};

const limpiarTemporalesBuild = () => {
  const temporales = [
    resolve(process.cwd(), 'tmp_apk_extract'),
  ];

  for (const ruta of temporales) {
    if (existsSync(ruta)) {
      rmSync(ruta, { recursive: true, force: true });
      console.log(`Temporal eliminado: ${ruta}`);
    }
  }
};

// Validar que estamos en un repo git.
run('git', ['rev-parse', '--is-inside-work-tree']);

// Build de produccion + sincronizacion docs antes de publicar.
if (process.platform === 'win32') {
  run('cmd.exe', ['/c', 'npm', 'run', 'build:pages']);
} else {
  run('npm', ['run', 'build:pages']);
}

// Sincronizar assets al proyecto Android (para que la APK quede al dia).
if (process.platform === 'win32') {
  run('cmd.exe', ['/c', 'npx', 'cap', 'copy', 'android'], true);
} else {
  run('npx', ['cap', 'copy', 'android'], true);
}

// Evitar commits masivos con archivos temporales de analisis de APK.
limpiarTemporalesBuild();

run('git', ['add', '-A']);

const commitStatus = run('git', ['commit', '-m', commitMessage], true);
if (commitStatus !== 0) {
  // Si no hay cambios para commitear, igual intentamos push por si faltaba publicar algo local.
  console.log('No hubo cambios nuevos para commitear o el commit no fue necesario.');
}

run('git', ['push', 'origin', 'main']);
console.log('Cambios sincronizados online (origin/main).');
