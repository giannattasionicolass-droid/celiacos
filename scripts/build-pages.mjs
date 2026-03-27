import { spawn } from 'node:child_process';

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
  process.exit(code ?? 1);
});
