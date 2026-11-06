import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli = fileURLToPath(new URL('../bin/nymwell.mjs', import.meta.url));

function execute(args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {env: {...process.env, ...env}});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({code, stdout, stderr}));
  });
}

async function mocked(args, responder, env = {}) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({method: request.method, url: request.url, headers: request.headers, body});
    const answer = await responder(requests.at(-1));
    response.writeHead(answer.status || 200, {'content-type': 'application/json'});
    response.end(JSON.stringify(answer.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    const result = await execute(args, {...env, NYMWELL_ORIGIN: `http://127.0.0.1:${address.port}`});
    return {...result, requests};
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('help and version are concise and work without a server', async () => {
  const help = await execute(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /search <name\|domain>/);
  assert.match(help.stdout, /transfer <domain>/);
  const version = await execute(['--version']);
  assert.deepEqual({code: version.code, stdout: version.stdout.trim()}, {code: 0, stdout: '0.1.1'});
});

test('search sends a full domain to the current search endpoint', async () => {
  const result = await mocked(['search', 'fresh.test'], () => ({body: {
    results: [{domain: 'fresh.test', available: true, price_minor: 1200, renewal_minor: 1400, buy_url: 'https://nymwell.com/buy?domain=fresh.test'}], suggestions: []
  }}), {NYMWELL_KEY: 'must-not-leak'});
  assert.equal(result.code, 0);
  assert.equal(result.requests[0].url, '/api/v1/domains/search?domain=fresh.test');
  assert.equal(result.requests[0].headers['x-nymwell-key'], undefined);
  assert.match(result.stdout, /US\$12\.00/);
  assert.match(result.stdout, /Buy:/);
});

test('search sends a label and requested endings', async () => {
  const result = await mocked(['search', 'fresh', '--tlds', 'com,io', '--json'], () => ({body: {results: [], suggestions: []}}));
  assert.equal(result.code, 0);
  assert.equal(result.requests[0].url, '/api/v1/domains/search?q=fresh&tlds=com%2Cio');
});

test('lookup and info use public screening, not the retired endpoints', async () => {
  const lookup = await mocked(['lookup', 'a.com', 'b.io'], () => ({body: {results: []}}));
  assert.equal(lookup.requests[0].url, '/api/v1/domains/screen?names=a.com%2Cb.io');
  const info = await mocked(['info', 'a.com'], () => ({body: {results: [{domain: 'a.com', status: 'registered', record: 'found', dns: true}]}}));
  assert.equal(info.code, 0);
  assert.equal(info.requests[0].url, '/api/v1/domains/screen?names=a.com');
  assert.match(info.stdout, /a\.com: registered/);
});

test('tlds has useful defaults instead of calling the retired list endpoint', async () => {
  const result = await mocked(['tlds'], () => ({body: {endings: []}}));
  assert.match(result.requests[0].url, /^\/api\/v1\/domains\/tld-info\?tlds=com%2Cai%2Cio/);
});

test('quote sends the key and the current request shape', async () => {
  const result = await mocked(['quote', 'fresh.com', '--years', '2'], () => ({body: {domain: 'fresh.com', quote_id: 'q_1', total_minor: 3000}}), {NYMWELL_KEY: 'agent-secret'});
  assert.equal(result.code, 0);
  assert.equal(result.requests[0].headers['x-nymwell-key'], 'agent-secret');
  assert.deepEqual(JSON.parse(result.requests[0].body), {domain: 'fresh.com', action: 'register', years: 2, currency: 'USD'});
  assert.match(result.stdout, /nymwell buy q_1/);
});

test('buy creates a hosted checkout without the retired pay_with field', async () => {
  const result = await mocked(['buy', 'q_1', '--locale', 'zh-tw'], () => ({body: {order_id: 'o_1', checkout_url: 'https://pay.example/1'}}), {NYMWELL_KEY: 'agent-secret'});
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.requests[0].body), {quote_id: 'q_1', locale: 'zh-tw'});
  assert.match(result.stdout, /Review and pay securely/);
  assert.match(result.stdout, /nymwell order o_1/);
});

test('transfer codes are never accepted on the command line', async () => {
  const safe = await execute(['transfer', 'fresh.com'], {NYMWELL_ORIGIN: 'https://nymwell.com'});
  assert.equal(safe.code, 0);
  assert.match(safe.stdout, /app\/transfers\/\?domain=fresh\.com/);
  const unsafe = await execute(['transfer-in', 'fresh.com', '--auth-code', 'secret'], {NYMWELL_ORIGIN: 'https://nymwell.com'});
  assert.equal(unsafe.code, 1);
  assert.match(unsafe.stderr, /do not put a transfer code on the command line/i);
  assert.doesNotMatch(unsafe.stdout + unsafe.stderr, /secret/);
});

test('provider failures explain that no charge occurred', async () => {
  const result = await mocked(['buy', 'q_1'], () => ({status: 503, body: {error: 'registrar_funds_low'}}), {NYMWELL_KEY: 'agent-secret'});
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Nothing was charged/);
  assert.match(result.stderr, /nymwell status/);
});
