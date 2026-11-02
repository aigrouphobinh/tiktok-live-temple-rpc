import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'temple-rpc-smoke-'));
const dataDirectory = path.join(temporaryRoot, 'data');
await mkdir(dataDirectory, { recursive: true });
await writeFile(path.join(dataDirectory, 'merit-state.json'), JSON.stringify({
  settings: { autoSim: true, autoSimIntervalMs: 60000 }
}), 'utf8');
const portServer = createServer();
const port = await new Promise((resolve, reject) => {
  portServer.once('error', reject);
  portServer.listen(0, '127.0.0.1', () => {
    const address = portServer.address();
    portServer.close((error) => error ? reject(error) : resolve(address.port));
  });
});
const baseUrl = 'http://127.0.0.1:' + port;
const wsUrl = 'ws://127.0.0.1:' + port + '/ws';
const child = spawn('bun', ['run', 'server.js'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    TEMPLE_DATA_DIR: dataDirectory,
    DISABLE_TIKTOK_AUTOCONNECT: '1',
    DISABLE_ZEROTTS_WORKER: '1',
    TEMPLE_CORS_ORIGINS: 'https://trusted.example'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
child.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
child.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForServer(timeoutMs = 15000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) throw new Error('Temple server exited early: ' + serverOutput);
    try {
      const response = await fetch(baseUrl + '/healthz');
      if (response.ok) return await response.json();
    } catch (error) { lastError = error; }
    await delay(150);
  }
  throw new Error('Temple server did not become ready: ' + String(lastError) + '\n' + serverOutput);
}

const messages = [];
const waiters = [];
function waitForMessage(predicate, timeoutMs = 7000) {
  const existing = messages.find(predicate);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, reject, timer: null };
    waiter.timer = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      reject(new Error('Timed out waiting for WebSocket message; received: ' + JSON.stringify(messages)));
    }, timeoutMs);
    waiters.push(waiter);
  });
}

let socket = null;
try {
  const health = await waitForServer();
  assert.equal(health.ok, true);
  assert.equal(health.tiktokConnected, false);
  assert.equal(health.tts.status, 'disabled');
  assert.equal(health.autoSimEnabled, true);
  assert.equal(health.autoSimRunning, true);

  const stopSimulation = await fetch(baseUrl + '/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'temple.updateSettings', params: { autoSim: false } })
  }).then((response) => response.json());
  assert.equal(stopSimulation.result.settings.autoSim, false);
  const stoppedHealth = await fetch(baseUrl + '/healthz').then((response) => response.json());
  assert.equal(stoppedHealth.autoSimRunning, false);

  const blockedOrigin = await fetch(baseUrl + '/healthz', { headers: { Origin: 'https://evil.example' } });
  assert.equal(blockedOrigin.status, 403);
  const allowedOrigin = await fetch(baseUrl + '/healthz', { headers: { Origin: 'https://trusted.example' } });
  assert.equal(allowedOrigin.status, 200);
  assert.equal(allowedOrigin.headers.get('access-control-allow-origin'), 'https://trusted.example');

  const page = await fetch(baseUrl + '/');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /stage9x16/);

  const initialStateResponse = await fetch(baseUrl + '/api/state');
  assert.equal(initialStateResponse.status, 200);
  const initialState = await initialStateResponse.json();
  assert.equal(typeof initialState.totalMerit, 'number');
  assert.equal(initialState.settings.musicVolume, 0.65);
  assert.equal(initialState.settings.ttsVolume, 0.95);

  const incenseResponse = await fetch(baseUrl + '/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'temple.burnIncense',
      params: { user: 'Integration Guest', count: 3, wish: 'Cầu bình an cho gia đình' }
    })
  });
  assert.equal(incenseResponse.status, 200);
  const incenseRpc = await incenseResponse.json();
  assert.equal(incenseRpc.result.event.type, 'burnIncense');
  assert.equal(incenseRpc.result.event.merit, 15);
  assert.equal(incenseRpc.result.state.totalMerit, initialState.totalMerit + 15);

  socket = new WebSocket(wsUrl);
  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      messages.push(message);
      for (const waiter of [...waiters]) {
        if (!waiter.predicate(message)) continue;
        clearTimeout(waiter.timer);
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    } catch (error) {
      console.warn('[smoke] Invalid WebSocket message:', error.message);
    }
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const initialWsState = await waitForMessage((message) => message.method === 'temple.state');
  assert.equal(initialWsState.params.totalMerit, initialState.totalMerit + 15);

  socket.send(JSON.stringify({
    jsonrpc: '2.0', id: 2, method: 'temple.strikeWoodenFish',
    params: { user: 'Integration Guest', count: 2 }
  }));
  const [woodenFishEvent, woodenFishReply] = await Promise.all([
    waitForMessage((message) => message.method === 'temple.event' && message.params?.event?.type === 'strikeWoodenFish'),
    waitForMessage((message) => message.id === 2)
  ]);
  assert.equal(woodenFishEvent.params.event.count, 2);
  assert.equal(woodenFishReply.result.event.type, 'strikeWoodenFish');

  const settingsReply = await fetch(baseUrl + '/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 3, method: 'temple.updateSettings',
      params: { musicVolume: 1.8, sfxVolume: 0.25, ttsEnabled: false, admin: true }
    })
  }).then((response) => response.json());
  assert.equal(settingsReply.result.settings.musicVolume, 1);
  assert.equal(settingsReply.result.settings.sfxVolume, 0.25);
  assert.equal(settingsReply.result.settings.ttsEnabled, false);
  assert.equal(Object.hasOwn(settingsReply.result.settings, 'admin'), false);

  const badRpc = await fetch(baseUrl + '/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'temple.methodThatDoesNotExist' })
  }).then((response) => response.json());
  assert.equal(badRpc.error.code, -32000);

  // The server debounces persistence by 1.2 seconds; verify the state survives a restart.
  await delay(1500);
  const persisted = JSON.parse(await readFile(path.join(dataDirectory, 'merit-state.json'), 'utf8'));
  assert.equal(persisted.totalMerit, initialState.totalMerit + 17);
  assert.equal(persisted.woodenFishHits, initialState.woodenFishHits + 2);
  assert.equal(persisted.settings.musicVolume, 1);

  console.log('[Temple integration smoke] PASS: page, health, state, HTTP RPC, WebSocket RPC, settings, errors and persistence.');
} catch (error) {
  console.error('[Temple integration smoke] FAIL:', error);
  console.error(serverOutput);
  process.exitCode = 1;
} finally {
  for (const waiter of waiters) { clearTimeout(waiter.timer); waiter.reject(new Error('Smoke test shutting down')); }
  socket?.close();
  if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(temporaryRoot, { recursive: true, force: true });
}
