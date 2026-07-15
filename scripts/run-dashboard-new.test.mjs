import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';

import { runDashboardNew } from './run-dashboard-new.mjs';

const createChild = () => {
  const handlers = new Map();
  return {
    handlers,
    killed: false,
    kill() {
      this.killed = true;
    },
    on(event, handler) {
      handlers.set(event, handler);
    },
  };
};

const createProcess = (overrides = {}) => {
  const handlers = new Map();
  const exitCodes = [];
  return {
    env: { TEST_ENV: '1' },
    execPath: '/runtime/node',
    platform: 'linux',
    handlers,
    exitCodes,
    exit(code) {
      exitCodes.push(code);
    },
    on(event, handler) {
      handlers.set(event, handler);
    },
    ...overrides,
  };
};

test('runDashboardNew prepares dependencies and starts the React Vite server', () => {
  const projectRoot = path.resolve('/project');
  const syncCalls = [];
  const spawnCalls = [];
  const children = [createChild()];
  const processLike = createProcess();

  const result = runDashboardNew({
    projectRoot,
    processLike,
    logger: { log() {}, error() {} },
    pathExists(file) {
      return false;
    },
    spawnCommandSync(command, args, options) {
      syncCalls.push({ command, args, options });
      return { status: 0 };
    },
    spawnCommand(command, args, options) {
      spawnCalls.push({ command, args, options });
      return children[spawnCalls.length - 1];
    },
  });

  assert.ok(result);
  assert.deepEqual(syncCalls.map(({ command, args }) => [command, args]), [
    ['pnpm', ['--dir', path.join(projectRoot, 'new-dashboard'), 'install']],
  ]);
  assert.deepEqual(spawnCalls.map(({ command, args }) => [command, args]), [
    ['pnpm', ['--dir', 'new-dashboard', 'dev']],
  ]);
  assert.equal(spawnCalls[0].options.cwd, projectRoot);
  assert.deepEqual([...processLike.handlers.keys()], ['SIGINT', 'SIGTERM']);
});

test('runDashboardNew exits when the React server stops', () => {
  const children = [createChild()];
  const processLike = createProcess();
  let childIndex = 0;

  runDashboardNew({
    processLike,
    logger: { log() {}, error() {} },
    pathExists: () => true,
    spawnCommandSync: () => ({ status: 0 }),
    spawnCommand: () => children[childIndex++],
  });

  children[0].handlers.get('exit')(7, null);

  assert.equal(children[0].killed, true);
  assert.deepEqual(processLike.exitCodes, [7]);

  processLike.handlers.get('SIGTERM')();
  assert.deepEqual(processLike.exitCodes, [7]);
});

test('runDashboardNew exits before spawning servers when preparation fails', () => {
  const processLike = createProcess();
  let spawnCount = 0;

  const result = runDashboardNew({
    processLike,
    logger: { log() {}, error() {} },
    pathExists: () => false,
    spawnCommandSync: () => ({ status: 1 }),
    spawnCommand: () => {
      spawnCount += 1;
      return createChild();
    },
  });

  assert.equal(result, null);
  assert.equal(spawnCount, 0);
  assert.deepEqual(processLike.exitCodes, [1]);
});
