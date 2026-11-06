#!/usr/bin/env node
// Nymwell from the terminal. No dependencies; Node 18+ (global fetch).

const VERSION = '0.1.1';
const DEFAULT_TLDS = 'com,ai,io,co,dev,app,net,org';
const origin = (process.env.NYMWELL_ORIGIN || 'https://nymwell.com').replace(/\/+$/, '');
const key = process.env.NYMWELL_KEY || '';

function fail(message) {
  if (message) console.error(message);
  process.exitCode = 1;
  throw new Error('__nymwell_handled__');
}

let originUrl;
try { originUrl = new URL(origin); } catch { fail(`NYMWELL_ORIGIN is not a URL: ${origin}`); }
const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(originUrl.hostname);
if (originUrl.protocol !== 'https:' && !(originUrl.protocol === 'http:' && localHost)) {
  fail(`NYMWELL_ORIGIN must use HTTPS (HTTP is allowed only for localhost): ${origin}`);
}

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
const valueFlags = new Set(['tlds', 'years', 'locale', 'auth-code']);
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === '-h') flags.help = true;
  else if (arg === '-v') flags.version = true;
  else if (arg.startsWith('--')) {
    const equal = arg.indexOf('=');
    const name = arg.slice(2, equal < 0 ? undefined : equal);
    if (equal >= 0) flags[name] = arg.slice(equal + 1);
    else if (valueFlags.has(name) && argv[index + 1] && !argv[index + 1].startsWith('-')) flags[name] = argv[++index];
    else flags[name] = true;
  } else positional.push(arg);
}

const [command, ...rest] = positional;
const asJson = Boolean(flags.json);

function help() {
  console.log(`nymwell ${VERSION} — find and manage domains

  search <name|domain> [--tlds com,io]  availability, price and buy link
  suggest <words> [--tlds com,io]       available name ideas
  lookup <domain> […]                   public registration records
  info <domain>                         public record for one domain
  tlds [com ai …]                       prices and rules for domain endings
  status                                service readiness

  quote <domain> [--years N]            create an exact quote (needs NYMWELL_KEY)
  buy <quote_id>                        create a secure checkout link
  order <order_id>                      follow an order
  domains | dns <domain>                account domains and DNS
  transfer <domain>                     open the secure transfer page

  --json  raw JSON output    --version  print the version
  Agent keys: ${origin}/app/agents/`);
}

function friendlyError(data, status) {
  const code = data?.error || `http_${status}`;
  if (code === 'authentication_required') return `Sign in required. Set NYMWELL_KEY to an agent key from ${origin}/app/agents/.`;
  if (['registrar_funds_low', 'registrar_unavailable', 'provider_unavailable'].includes(code) || status === 503) {
    return 'Domain checkout is temporarily unavailable. Nothing was charged. Try again later or run: nymwell status';
  }
  if (status === 429) return 'Too many requests. Wait a moment, then try again.';
  return `${code}${data?.message ? `: ${data.message}` : ''}${data?.next ? `\n${data.next}` : ''}`;
}

async function call(path, {method = 'GET', body, needsKey = false} = {}) {
  if (needsKey && !key) fail(`This command needs your account. Set NYMWELL_KEY to an agent key from ${origin}/app/agents/.`);
  if (needsKey && originUrl.hostname !== 'nymwell.com' && !localHost) console.error(`Note: your NYMWELL_KEY will be sent to ${originUrl.host}.`);
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        'user-agent': `nymwell-cli/${VERSION}`,
        ...(needsKey ? {'x-nymwell-key': key} : {}),
        ...(body ? {'content-type': 'application/json'} : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: needsKey ? 'error' : 'follow'
    });
  } catch (error) {
    fail(`Could not reach Nymwell: ${error instanceof Error ? error.message : String(error)}`);
  }
  const data = await response.json().catch(() => ({error: `http_${response.status}`}));
  if (!response.ok || data.error) {
    if (asJson) console.log(JSON.stringify(data, null, 2));
    fail(asJson ? '' : friendlyError(data, response.status));
  }
  return data;
}

const money = (minor, display) => display || (minor === null || minor === undefined ? '—' : `US$${(minor / 100).toFixed(2)}`);
const pad = (value, width) => String(value ?? '').padEnd(width);
const print = data => console.log(JSON.stringify(data, null, 2));
const tldsQuery = () => flags.tlds && flags.tlds !== 'all' ? `&tlds=${encodeURIComponent(String(flags.tlds))}` : '';

function printSearchItem(item) {
  if (!item.available) return console.log(`${pad(item.domain, 34)} unavailable${item.reason ? ` · ${item.reason.replaceAll('_', ' ')}` : ''}`);
  console.log(`${pad(item.domain, 34)} ${pad(money(item.price_minor, item.price_display), 12)} renews ${money(item.renewal_minor, item.renewal_display)}${item.premium ? ' · premium' : ''}`);
  if (item.buy_url) console.log(`  Buy: ${item.buy_url}`);
}

async function search() {
  if (!rest.length) fail('Usage: nymwell search <name|domain> [--tlds com,io]');
  const responses = [];
  for (const value of rest) {
    const parameter = value.includes('.') ? `domain=${encodeURIComponent(value)}` : `q=${encodeURIComponent(value)}`;
    responses.push(await call(`/api/v1/domains/search?${parameter}${tldsQuery()}`));
  }
  const data = responses.length === 1 ? responses[0] : {
    results: responses.flatMap(item => item.results || []), suggestions: responses.flatMap(item => item.suggestions || []), currency: responses[0]?.currency
  };
  if (asJson) return print(data);
  for (const item of data.results || []) printSearchItem(item);
  if ((data.suggestions || []).length) {
    console.log('\nOther available names:');
    for (const item of data.suggestions.slice(0, 5)) printSearchItem(item);
  }
}

async function suggest() {
  if (!rest.length) fail('Usage: nymwell suggest <words> [--tlds com,io]');
  const data = await call(`/api/v1/domains/suggest?q=${encodeURIComponent(rest.join(' '))}${tldsQuery()}`);
  if (asJson) return print(data);
  for (const item of data.results || []) printSearchItem(item);
}

async function lookup() {
  if (!rest.length) fail('Usage: nymwell lookup <domain> [domain …]');
  const label = rest.length === 1 && !rest[0].includes('.') ? rest[0] : null;
  const query = label ? `q=${encodeURIComponent(label)}${tldsQuery()}` : `names=${encodeURIComponent(rest.join(','))}`;
  const data = await call(`/api/v1/domains/screen?${query}`);
  if (asJson) return print(data);
  for (const item of data.results || []) {
    const detail = item.record === 'found' ? [item.registrar, item.expires_at ? `expires ${item.expires_at.slice(0, 10)}` : null].filter(Boolean).join(' · ') : 'no public registry record — confirm with search';
    console.log(`${pad(item.domain, 34)} ${pad(item.status || item.record, 12)} ${detail}`);
  }
}

async function info() {
  if (!rest[0]) fail('Usage: nymwell info <domain>');
  const data = await call(`/api/v1/domains/screen?names=${encodeURIComponent(rest[0])}`);
  if (asJson) return print(data);
  const item = data.results?.[0];
  if (!item) fail('No public record returned.');
  console.log(`${item.domain}: ${item.status || item.record}`);
  if (item.registrar) console.log(`  registrar   ${item.registrar}`);
  if (item.registered_at) console.log(`  created     ${item.registered_at.slice(0, 10)}`);
  if (item.expires_at) console.log(`  expires     ${item.expires_at.slice(0, 10)}`);
  if (item.nameservers?.length) console.log(`  nameservers ${item.nameservers.join(', ')}`);
  console.log(`  DNS         ${item.dns ? 'active' : 'not found'}`);
}

async function tlds() {
  const endings = rest.length ? rest.map(value => value.replace(/^\./, '')).join(',') : DEFAULT_TLDS;
  const data = await call(`/api/v1/domains/tld-info?tlds=${encodeURIComponent(endings)}`);
  if (asJson) return print(data);
  console.log(`${pad('ending', 10)} ${pad('first term', 12)} ${pad('renewal', 12)} years`);
  for (const item of data.endings || []) {
    const first = item.registration_minor == null ? 'check a name' : money(item.registration_minor);
    const renewal = item.renewal_minor == null ? 'check a name' : money(item.renewal_minor);
    console.log(`${pad(`.${item.tld}`, 10)} ${pad(first, 12)} ${pad(renewal, 12)} ${(item.allowed_years || []).join(',')}`);
  }
}

async function status() {
  const data = await call('/api/v1/status');
  if (asJson) return print(data);
  console.log(data.ready ? 'Nymwell is ready.' : `Nymwell is not ready: ${data.message || 'service unavailable'}`);
  console.log(`  Search ${data.capabilities?.domain_search ? 'ready' : 'unavailable'} · checkout ${data.capabilities?.registration ? 'ready' : 'unavailable'} · DNS ${data.capabilities?.dns_read ? 'ready' : 'unavailable'}`);
}

async function quote() {
  if (!rest[0]) fail('Usage: nymwell quote <domain> [--years N] [--renew]');
  const years = Number(flags.years || 1);
  if (!Number.isInteger(years) || years < 1 || years > 10) fail('--years must be a whole number from 1 to 10.');
  const action = flags.renew ? 'renew' : 'register';
  const data = await call('/api/v1/quotes', {method: 'POST', needsKey: true, body: {domain: rest[0], action, years, currency: 'USD'}});
  if (asJson) return print(data);
  console.log(`${data.domain || rest[0]} · ${action} · ${money(data.total_minor, data.total_display)}`);
  console.log(`Next: nymwell buy ${data.quote_id}`);
}

async function buy() {
  if (!rest[0]) fail('Usage: nymwell buy <quote_id>');
  const body = {quote_id: rest[0]};
  if (flags.locale) body.locale = String(flags.locale).toLowerCase() === 'zh-tw' ? 'zh-tw' : 'en';
  const data = await call('/api/v1/orders', {method: 'POST', needsKey: true, body});
  if (asJson) return print(data);
  if (data.checkout_url) console.log(`Review and pay securely: ${data.checkout_url}`);
  else console.log(`${data.domain || 'Order'}: ${data.status || 'created'}`);
  if (data.order_id) console.log(`Track it: nymwell order ${data.order_id}`);
}

async function order() {
  if (!rest[0]) fail('Usage: nymwell order <order_id>');
  const data = await call(`/api/v1/orders?id=${encodeURIComponent(rest[0])}`, {needsKey: true});
  if (asJson) return print(data);
  console.log(`${data.domain || rest[0]}: ${data.status}${data.workflow?.state ? ` · ${data.workflow.state}` : ''}`);
  if (data.next) console.log(data.next);
  if (data.checkout_url) console.log(`Pay: ${data.checkout_url}`);
}

async function domains() {
  const data = await call('/api/v1/domains', {needsKey: true});
  if (asJson) return print(data);
  for (const item of data.domains || []) console.log(`${pad(item.name || item.domain, 34)} ${pad(item.status, 12)} expires ${String(item.expires_at || '—').slice(0, 10)}`);
}

async function dns() {
  if (!rest[0]) fail('Usage: nymwell dns <domain>');
  const data = await call(`/api/v1/dns/records?domain=${encodeURIComponent(rest[0])}`, {needsKey: true});
  if (asJson) return print(data);
  for (const record of data.records || []) console.log(`${pad(record.type, 6)} ${pad(record.name, 24)} ${record.content || record.value}`);
}

async function transfer() {
  if (!rest[0]) fail('Usage: nymwell transfer <domain>');
  if (flags['auth-code']) fail('For your security, do not put a transfer code on the command line. Enter it on the secure Nymwell page.');
  const url = `${origin}/app/transfers/?domain=${encodeURIComponent(rest[0])}`;
  if (asJson) return print({domain: rest[0], transfer_url: url, next: 'Sign in and enter the transfer code on this secure page.'});
  console.log(`Continue securely in your browser: ${url}`);
  console.log('Enter the transfer code there, not in the terminal.');
}

const commands = {search, check: search, suggest, lookup, info, tlds, status, quote, buy, order, domains, dns, transfer, 'transfer-in': transfer};

async function main() {
  if (flags.version) return console.log(VERSION);
  if (flags.help || !command) return help();
  if (!commands[command]) fail(`Unknown command: ${command}\nRun nymwell --help to see the available commands.`);
  await commands[command]();
}

main().catch(error => {
  if (error?.message !== '__nymwell_handled__') {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
