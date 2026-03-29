import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const userMessage = process.argv.slice(2).join(' ').trim();
const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
const commitMessage = userMessage || `sync: apk online update ${timestamp}`;
const buildId = new Date().toISOString();

const rootDir = process.cwd();

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    cwd: options.cwd || rootDir,
    env: options.env || process.env,
  });

  if (result.error) {
    console.error(`Error ejecutando ${cmd}:`, result.error.message);
    process.exit(1);
  }

  if (result.status !== 0 && !options.allowFailure) {
    process.exit(result.status || 1);
  }

  return result.status || 0;
};

const runNpmScript = (scriptName) => {
  const env = { ...process.env, APP_BUILD_ID: buildId };

  if (process.platform === 'win32') {
    run('cmd.exe', ['/c', 'npm', 'run', scriptName], { env });
  } else {
    run('npm', ['run', scriptName], { env });
  }
};

const runCapSyncAndroid = () => {
  if (process.platform === 'win32') {
    run('cmd.exe', ['/c', 'npx', 'cap', 'sync', 'android'], { allowFailure: true });
  } else {
    run('npx', ['cap', 'sync', 'android'], { allowFailure: true });
  }
};

const runAssembleDebug = () => {
  const androidDir = resolve(rootDir, 'android');

  if (process.platform === 'win32') {
    run('cmd.exe', ['/c', 'gradlew.bat', 'clean', 'assembleDebug'], { cwd: androidDir });
  } else {
    run('./gradlew', ['clean', 'assembleDebug'], { cwd: androidDir });
  }
};

const limpiarTemporalesBuild = () => {
  const temporales = [
    resolve(rootDir, 'tmp_apk_extract'),
  ];

  for (const ruta of temporales) {
    if (existsSync(ruta)) {
      rmSync(ruta, { recursive: true, force: true });
      console.log(`Temporal eliminado: ${ruta}`);
    }
  }

  // Eliminar APKs copiados por error dentro de assets Android.
  const androidAssets = resolve(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');
  if (existsSync(androidAssets)) {
    try {
      const files = readdirSync(androidAssets);
      for (const f of files) {
        if (f.endsWith('.apk')) {
          const apkPath = resolve(androidAssets, f);
          rmSync(apkPath, { force: true });
          console.log(`APK eliminado de assets Android: ${f}`);
        }
      }
    } catch {
      // no-op
    }
  }
};

const publicarApkYVersion = () => {
  const apkOrigen = resolve(process.env.LOCALAPPDATA || rootDir, 'celiashop-gradle-build', 'app', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const docsDir = resolve(rootDir, 'docs');
  const apkDestinoPrincipal = resolve(docsDir, 'celiashop-android.apk');
  const apkDestinoAlias = resolve(docsDir, 'celiashop.apk');

  if (!existsSync(apkOrigen)) {
    console.error('No se encontro app-debug.apk luego del build Android.');
    process.exit(1);
  }

  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  copyFileSync(apkOrigen, apkDestinoPrincipal);
  copyFileSync(apkOrigen, apkDestinoAlias);

  const apkStats = statSync(apkOrigen);
  const apkVersionPath = resolve(docsDir, 'apk-version.json');

  writeFileSync(
    apkVersionPath,
    JSON.stringify(
      {
        apkBuildId: buildId,
        generatedAt: buildId,
        apkFile: 'celiashop-android.apk',
        apkSizeBytes: apkStats.size,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`APK publicada en docs (${apkStats.size} bytes).`);
  console.log(`apk-version.json actualizado con build ${buildId}.`);
};

run('git', ['rev-parse', '--is-inside-work-tree']);

runNpmScript('build:pages');
runNpmScript('build');
runCapSyncAndroid();
runAssembleDebug();
limpiarTemporalesBuild();
publicarApkYVersion();

run('git', ['add', '-A']);
const commitStatus = run('git', ['commit', '-m', commitMessage], { allowFailure: true });

if (commitStatus !== 0) {
  console.log('No hubo cambios nuevos para commitear o el commit no fue necesario.');
}

run('git', ['push', 'origin', 'main']);
console.log('APK y web sincronizadas online (origin/main).');
