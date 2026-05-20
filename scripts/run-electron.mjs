#!/usr/bin/env node
/**
 * Launch the real Electron binary (not Node running main as a script).
 * Cursor/IDE shells often set ELECTRON_RUN_AS_NODE, which breaks the main process.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const rootDir = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env,
  cwd: rootDir,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
