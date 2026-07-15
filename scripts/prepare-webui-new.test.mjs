import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';

import { prepareWebuiNew } from './prepare-webui-new.mjs';

const createOptions = (overrides = {}) => {
  const projectRoot = path.resolve('/project');
  const calls = [];
  return {
    calls,
    options: {
      projectRoot,
      env: {},
      logger: { log() {}, error() {} },
      assertNodeVersion: () => calls.push(['assert-node']),
      loadEnv: () => calls.push(['load-env']),
      pathExists: () => true,
      patchMonaco: async (options) => calls.push(['patch-monaco', options]),
      spawnCommandSync: (command, args, options) => {
        calls.push(['command', command, args, options]);
        return { status: 0 };
      },
      sync: async (source, target) => calls.push(['sync', source, target]),
      ...overrides,
    },
  };
};

test('prepareWebuiNew builds and publishes the standalone React dashboard', async () => {
  const { calls, options } = createOptions({
    env: {
      ASTRBOT_DESKTOP_RELEASE_BASE_URL: ' https://downloads.example.test/releases ',
    },
  });

  await prepareWebuiNew(options);

  assert.deepEqual(calls.map((call) => call[0]), [
    'assert-node',
    'load-env',
    'patch-monaco',
    'command',
    'sync',
  ]);

  const commands = calls.filter(([type]) => type === 'command');
  assert.deepEqual(commands.map(([, command, args]) => [command, args]), [
    ['pnpm', ['--dir', path.join(options.projectRoot, 'new-dashboard'), 'build']],
  ]);
  assert.equal(
    commands[0][3].env.VITE_ASTRBOT_RELEASE_BASE_URL,
    'https://downloads.example.test/releases',
  );

  const syncCalls = calls.filter(([type]) => type === 'sync');
  assert.deepEqual(syncCalls, [[
    'sync',
    path.join(options.projectRoot, 'new-dashboard', 'dist'),
    path.join(options.projectRoot, 'resources', 'webui'),
  ]]);
});

test('prepareWebuiNew installs missing React dependencies', async () => {
  const projectRoot = path.resolve('/project');
  const { calls, options } = createOptions({
    projectRoot,
    pathExists(file) {
      return file === path.join(projectRoot, 'new-dashboard', 'dist', 'index.html');
    },
  });

  await prepareWebuiNew(options);

  const commands = calls.filter(([type]) => type === 'command');
  assert.deepEqual(commands.slice(0, 1).map(([, command, args]) => [command, args]), [
    ['pnpm', ['--dir', path.join(projectRoot, 'new-dashboard'), 'install']],
  ]);
});

test('prepareWebuiNew rejects missing React build output before publishing resources', async () => {
  const { calls, options } = createOptions({
    pathExists(file) {
      return !file.endsWith(path.join('dist', 'index.html'));
    },
  });

  await assert.rejects(() => prepareWebuiNew(options), /React WebUI build output missing:/);
  assert.equal(calls.filter(([type]) => type === 'sync').length, 0);
});

test('prepareWebuiNew surfaces failed child commands', async () => {
  const { options } = createOptions({
    spawnCommandSync: () => ({ status: 2 }),
  });

  await assert.rejects(
    () => prepareWebuiNew(options),
    /Command failed: pnpm .*new-dashboard.* build/,
  );
});
