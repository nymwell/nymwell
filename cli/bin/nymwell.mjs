#!/usr/bin/env node
// Nymwell from the terminal. No dependencies; Node 18+ (global fetch).
//
//   nymwell lookup noren --tlds all        many names at once (DNS + RDAP, free)
//   nymwell check noren.com noren.ai       the registrar's answer and price
//   nymwell info example.com               everything public about one domain
//   nymwell tlds [com ai]                  endings, prices and rules
//   nymwell quote noren.com [--years 2] [--renew|--transfer]
//   nymwell buy <quote_id> [--checkout]    pays on the saved card within the agent limits
//   nymwell order <order_id>
//   nymwell domains | dns <domain>
//   nymwell transfer-in <domain> --auth-code <code>
//
// Account commands need NYMWELL_KEY (an agent key from https://nymwell.com/app/agents/).
// --json prints the raw answer. NYMWELL_ORIGIN points at another server.

const origin = (process.env.NYMWELL_ORIGIN || 'https://nymwell.com').replace(/\/+$/, '');
const key = process.env.NYMWELL_KEY || '';
// The agent key only ever travels over HTTPS (plain http only to this machine),
// and a server other than nymwell.com is named out loud before it gets the key.
let originUrl;
try { originUrl = new URL(origin); } catch { fail(`NYMWELL_ORIGIN is not a URL: ${origin}`); }
const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(originUrl.hostname);
if (originUrl.protocol !== 'https:' && !(originUrl.protocol === 'http:' && localHost)) fail(`NYMWELL_ORIGIN must be https:// (plain http only for localhost): ${origin}`);
if (key && originUrl.hostname !== 'nymwell.com' && !localHost) console.error(`Note: NYMWELL_ORIGIN is ${originUrl.host}, so your NYMWELL_KEY goes to that server, not nymwell.com.`);
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg.startsWith('--')) {
    const [name, inline] = arg.slice(2).split('=');
    const next = argv[index + 1];
    if (inline !== undefined) flags[name] = inline;
    else if (next !== undefined && !next.startsWith('--') && ['tlds', 'years', 'auth-code', 'details'].includes(name)) { flags[name] = next; index += 1; }
    else flags[name] = true;
  } else positional.push(arg);
}
const [command, ...rest] = positional;
const asJson = Boolean(flags.json);

async function call(path, {method = 'GET', body, needsKey = false, accept} = {}) {
  if (needsKey && !key) fail('This command works on your account: set NYMWELL_KEY to an agent key from https://nymwell.com/app/agents/.');
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: {'user-agent': 'nymwell-cli/0.1.0', ...(key ? {'x-nymwell-key': key} : {}), ...(body ? {'content-type': 'application/json'} : {}), ...(accept ? {accept} : {})},
    body: body ? JSON.stringify(body) : undefined,
    // A redirect would carry the key to wherever it points, so a keyed call never follows one.
    redirect: key ? 'error' : 'follow'
  });
  return response;
}

async function jsonCall(path, options) {
  const response = await call(path, options);
  const data = await response.json().catch(() => ({error: `http_${response.status}`}));
  if (!response.ok || data.error) {
    if (asJson) { console.log(JSON.stringify(data, null, 2)); process.exit(1); }
    fail(`${data.error || response.status}${data.message ? `: ${data.message}` : ''}${data.next ? `\n${data.next}` : ''}`);
  }
  return data;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const money = minor => minor === null || minor === undefined ? '—' : `US$${(minor / 100).toFixed(2)}`;
const pad = (value, width) => String(value ?? '').padEnd(width);
const print = data => console.log(JSON.stringify(data, null, 2));

async function lookup() {
  const word = rest.length === 1 && !rest[0].includes('.') ? rest[0] : null;
  const body = word ? {q: word, tlds: flags.tlds === 'all' ? 'all' : flags.tlds ? String(flags.tlds).split(',') : undefined} : {domains: rest};
  if (flags.details !== undefined) body.details = flags.details !== 'false';
  if (!word && !rest.length) fail('Usage: nymwell lookup <word> [--tlds all|com,io] | nymwell lookup a.com b.io …');
  // Results stream in as they are found.
  const response = await call('/api/v1/domains/lookup', {method: 'POST', body, accept: 'application/x-ndjson'});
  if (!response.ok) fail(`lookup failed: ${response.status} ${await response.text()}`);
  const decoder = new TextDecoder();
  let buffer = '';
  let pending = [];
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, {stream: true});
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const item = JSON.parse(line);
      if (item.error) fail(`${item.error}${item.next ? `\n${item.next}` : ''}`);
      if (item.done) { pending = item.pending || []; continue; }
      if (asJson) { console.log(JSON.stringify(item)); continue; }
      const verdict = item.taken === true ? 'taken' : item.taken === false ? 'no record' : item.status === 'not_in_zone' ? 'not in DNS' : 'unknown';
      const open = item.taken === false || item.status === 'not_in_zone';
      const extra = open ? (item.offered === false ? 'ending not sold here' : `${money(item.list_price_minor)}${item.list_years > 1 ? ` for ${item.list_years} years` : ''} list · confirm: nymwell check ${item.domain}`) : item.registrar ? `${item.registrar}${item.expires_at ? ` · expires ${item.expires_at.slice(0, 10)}` : ''}` : item.for_sale ? 'parked for sale' : '';
      console.log(`${pad(item.domain, 34)} ${pad(verdict, 10)} ${extra}`);
    }
  }
  if (pending.length) console.error(`\n${pending.length} names not looked up yet: nymwell lookup ${pending.slice(0, 5).join(' ')}${pending.length > 5 ? ' …' : ''}`);
}

async function check() {
  if (!rest.length) fail('Usage: nymwell check <domain> [domain …]');
  const data = await jsonCall(`/api/v1/domains/search?domains=${encodeURIComponent(rest.join(','))}`);
  if (asJson) return print(data);
  for (const item of data.results) console.log(`${pad(item.domain, 34)} ${item.available ? `${pad('available', 11)} ${money(item.price_minor)} first term · renews ${money(item.renewal_minor)}${item.tier === 'premium' ? ' · premium' : ''}` : `not available (${item.reason})`}`);
  const buyable = data.results.filter(item => item.available);
  if (buyable.length) console.log(`\nBuy: nymwell quote ${buyable[0].domain}   or give the person ${buyable[0].buy_url}`);
}

async function info() {
  if (!rest[0]) fail('Usage: nymwell info <domain>');
  const data = await jsonCall(`/api/v1/domains/info?domain=${encodeURIComponent(rest[0])}`);
  if (asJson) return print(data);
  console.log(`${data.domain}: ${data.status}`);
  if (data.registry.registrar) console.log(`  registrar   ${data.registry.registrar}`);
  if (data.registry.registered_at) console.log(`  created     ${data.registry.registered_at.slice(0, 10)}`);
  if (data.registry.expires_at) console.log(`  expires     ${data.registry.expires_at.slice(0, 10)}`);
  if (data.dns.nameservers.length) console.log(`  nameservers ${data.dns.nameservers.join(', ')}${data.dns.host ? ` (${data.dns.host})` : ''}`);
  console.log(`  website     ${data.website.https === null ? 'none' : data.website.https ? 'answers over HTTPS' : 'HTTPS does not answer'}`);
  console.log(`  email       ${data.dns.accepts_mail === false ? 'takes no email (null MX)' : data.dns.mx.length ? data.dns.mx.join(', ') : 'no MX'} · SPF ${data.dns.spf ? 'yes' : 'no'} · DMARC ${data.dns.dmarc ? 'yes' : 'no'}`);
  if (data.next.buy_url) console.log(`  next        nymwell check ${data.domain}, then buy: ${data.next.buy_url}`);
  if (data.next.transfer_url) console.log(`  next        move it to Nymwell: ${data.next.transfer_url}${data.next.transfer_possible_after ? ` (after ${data.next.transfer_possible_after.slice(0, 10)})` : ''}`);
}

async function tlds() {
  const data = rest.length ? await jsonCall(`/api/v1/domains/tld-info?tlds=${encodeURIComponent(rest.join(','))}`) : await jsonCall('/api/v1/tlds');
  if (asJson) return print(data);
  console.log(`${pad('ending', 14)} ${pad('first year', 12)} ${pad('renewal', 12)} transfer`);
  for (const item of data.endings) console.log(`${pad(`.${item.tld}`, 14)} ${pad(money(item.registration_minor), 12)} ${pad(money(item.renewal_minor), 12)} ${money(item.transfer_minor)}`);
}

async function quote() {
  if (!rest[0]) fail('Usage: nymwell quote <domain> [--years N] [--renew|--transfer]');
  const action = flags.renew ? 'renew' : flags.transfer ? 'transfer' : 'register';
  const data = await jsonCall('/api/v1/quotes', {method: 'POST', needsKey: true, body: {domain: rest[0], action, years: Number(flags.years || 1), currency: 'USD'}});
  if (asJson) return print(data);
  console.log(`${data.domain} · ${action} · ${money(data.total_minor)} (locked until ${String(data.expires_at).slice(11, 16)} UTC)\nBuy: nymwell buy ${data.quote_id}`);
}

async function buy() {
  if (!rest[0]) fail('Usage: nymwell buy <quote_id> [--checkout]');
  const data = await jsonCall('/api/v1/orders', {method: 'POST', needsKey: true, body: {quote_id: rest[0], ...(flags.checkout ? {pay_with: 'checkout'} : {})}});
  if (asJson) return print(data);
  if (data.checkout_url) console.log(`Payment needed (${data.checkout_reason || 'checkout'}): ${data.checkout_url}`);
  else console.log(`${data.domain}: ${data.status} · paid with ${data.paid_with}`);
  console.log(`Status: nymwell order ${data.order_id}`);
}

async function order() {
  if (!rest[0]) fail('Usage: nymwell order <order_id>');
  const data = await jsonCall(`/api/v1/orders?id=${encodeURIComponent(rest[0])}`, {needsKey: true});
  if (asJson) return print(data);
  console.log(`${data.domain}: ${data.status} · ${data.workflow?.state}${data.next ? `\n${data.next}` : ''}`);
}

async function domains() {
  const data = await jsonCall('/api/v1/domains', {needsKey: true});
  if (asJson) return print(data);
  for (const item of data.domains) console.log(`${pad(item.name, 34)} ${pad(item.status, 10)} expires ${String(item.expires_at || '—').slice(0, 10)} · auto-renew ${item.auto_renew ? 'on' : 'off'}`);
}

async function dns() {
  if (!rest[0]) fail('Usage: nymwell dns <domain>');
  const data = await jsonCall(`/api/v1/dns/records?domain=${encodeURIComponent(rest[0])}`, {needsKey: true});
  if (asJson) return print(data);
  for (const record of data.records) console.log(`${pad(record.type, 6)} ${pad(record.name, 24)} ${record.content}`);
}

async function transferIn() {
  if (!rest[0] || !flags['auth-code']) fail('Usage: nymwell transfer-in <domain> --auth-code <code>');
  const data = await jsonCall('/api/v1/transfers', {method: 'POST', needsKey: true, body: {domain: rest[0], auth_code: String(flags['auth-code'])}});
  if (asJson) return print(data);
  console.log(`${data.domain}: transfer quote ${money(data.total_minor)}\nBuy: nymwell buy ${data.quote_id}`);
}

const commands = {lookup, check, info, tlds, quote, buy, order, domains, dns, 'transfer-in': transferIn};
if (!commands[command]) {
  console.log(`nymwell — domains from the terminal (${origin})

  lookup <word> [--tlds all|com,io]   many names at once, free (DNS + public registry records)
  lookup <a.com> <b.io> …
  check <domain> […]                  the registrar's answer and price
  info <domain>                       everything public about one domain
  tlds [ending …]                     endings, prices and rules
  quote <domain> [--years N] [--renew|--transfer]       needs NYMWELL_KEY
  buy <quote_id> [--checkout]         saved card within the agent limits, else a payment link
  order <order_id> | domains | dns <domain>
  transfer-in <domain> --auth-code <code>

  --json for the raw answer. NYMWELL_KEY: an agent key from ${origin}/app/agents/`);
  process.exit(command ? 1 : 0);
}
commands[command]().catch(error => fail(error instanceof Error ? error.message : String(error)));
