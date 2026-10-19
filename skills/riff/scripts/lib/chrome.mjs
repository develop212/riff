// Drives the browser the user already has (Chrome, Edge, Chromium or Brave) over the
// DevTools protocol, so motion capture needs no npm install. Requires Node 22+ for the
// built-in WebSocket. Runs headless with a fresh temporary profile: no cookies, no
// logins, no extensions, and the profile is deleted on close.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function candidates() {
  const home = process.env.HOME || '';
  if (process.platform === 'darwin') {
    return [
      'Google Chrome.app/Contents/MacOS/Google Chrome',
      'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'Brave Browser.app/Contents/MacOS/Brave Browser',
      'Chromium.app/Contents/MacOS/Chromium',
      'Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ].flatMap((app) => [path.join('/Applications', app), path.join(home, 'Applications', app)]);
  }
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((root) => [
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(root, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    ]);
  }
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'];
  return (process.env.PATH || '').split(path.delimiter).flatMap((dir) => names.map((n) => path.join(dir, n)));
}

export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  return candidates().find((p) => existsSync(p)) || null;
}

// Returns a small page driver ({ kind, goto, evaluate, screenshot, wait, close }),
// or { error } explaining why no browser could be used.
export async function openChrome({ width = 1440, height = 900, userAgent } = {}) {
  if (typeof WebSocket === 'undefined') return { error: 'needs Node 22 or newer (built-in WebSocket)' };
  const exe = findChrome();
  if (!exe) return { error: 'no Chrome, Edge, Chromium or Brave found (set CHROME_PATH to use another Chromium browser)' };

  const profile = await mkdtemp(path.join(tmpdir(), 'riff-chrome-'));
  const child = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
    '--hide-scrollbars', '--mute-audio', `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  const cleanup = async () => {
    child.kill();
    await sleep(300);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };

  let port = null;
  for (let i = 0; i < 150 && !port; i++) {
    try {
      const [p] = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      if (p?.trim()) port = p.trim();
    } catch {
      // not written yet
    }
    if (!port) await sleep(100);
  }
  if (!port) {
    await cleanup();
    return { error: `${path.basename(exe)} did not start` };
  }

  let ws;
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page')
      || await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('could not connect to the browser'));
    });
  } catch (err) {
    await cleanup();
    return { error: err.message };
  }

  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const waitFor = (method, timeout) => new Promise((resolve) => {
    const done = (ok) => {
      clearTimeout(timer);
      listeners.set(method, (listeners.get(method) || []).filter((f) => f !== onEvent));
      resolve(ok);
    };
    const onEvent = () => done(true);
    const timer = setTimeout(() => done(false), timeout);
    listeners.set(method, [...(listeners.get(method) || []), onEvent]);
  });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  if (userAgent) await send('Network.setUserAgentOverride', { userAgent });

  return {
    kind: path.basename(exe),
    async goto(url) {
      const loaded = waitFor('Page.loadEventFired', 45_000);
      await send('Page.navigate', { url });
      await loaded;
      await sleep(2000); // let late scripts and lazy media settle
    },
    // Accepts an expression string, or a function plus one JSON-serialisable argument.
    async evaluate(src, arg) {
      const expression = typeof src === 'function' ? `(${src})(${JSON.stringify(arg ?? null)})` : src;
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(file, Buffer.from(data, 'base64'));
    },
    wait: sleep,
    async close() {
      try { ws.close(); } catch { /* already closed */ }
      await cleanup();
    },
  };
}
