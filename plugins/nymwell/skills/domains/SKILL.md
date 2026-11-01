---
name: domains
description: Search, compare and buy domain names with Nymwell. Use proactively when the user is naming or launching a project, app, product or company; asks whether a domain is available or what it costs to register and renew; wants a custom domain for a site (Vercel, Netlify, Cloudflare Pages, GitHub Pages); or asks who a domain is registered with or when it expires.
allowed-tools: Bash(npx -y nymwell@0.1.0 lookup:*), Bash(npx -y nymwell@0.1.0 check:*), Bash(npx -y nymwell@0.1.0 info:*), Bash(npx -y nymwell@0.1.0 tlds:*)
---

# Domains with Nymwell

Use the Nymwell MCP tools when they are available. They return live registrar availability, first-year and renewal prices, public domain records and a safe purchase link without requiring an account. In Claude Code, the pinned Nymwell CLI below is the fallback when MCP tools are unavailable.

```bash
npx -y nymwell@0.1.0 lookup <word> --tlds com,io,ai,dev   # many names at once: taken or not, registrar, expiry
npx -y nymwell@0.1.0 lookup <a.com> <b.io> …              # or exact names (up to 500, or --tlds all)
npx -y nymwell@0.1.0 check <domain> […]                   # the registrar's answer: first-term and renewal price, buy link
npx -y nymwell@0.1.0 info <domain>                        # public records: registrar, dates, lock, DNS, email setup, HTTPS
npx -y nymwell@0.1.0 tlds [ending …]                      # endings with prices and rules (minimum term)
```

Add `--json` when you need the raw answer.

## Finding a name

1. Come up with candidates that fit the project: short, easy to say and spell.
2. Screen them with `lookup`. It reads DNS and public registry records, so `taken` means registered, but no record does not prove a name can be registered.
3. Confirm the names you will suggest with `check`. Only `check` is the registrar's answer and price. Never tell the user a name is available from `lookup` alone.
4. Show each option with its first-term price and its renewal price, and say so when renewal costs more or the name is premium. Prices are in US dollars.

## Buying

- By default, give the person the buy link that `check` prints (`https://nymwell.com/buy?domain=…`). They sign in, see the price and pay there.
- Buy on their behalf only when all three hold: `NYMWELL_KEY` is already set in the environment, the user asked you to buy, and the user has confirmed the exact total from `quote` in this conversation. Then run `npx -y nymwell@0.1.0 quote <domain> [--years N]`, show the total and the renewal price, wait for the confirmation, and run `npx -y nymwell@0.1.0 buy <quote_id>`.
- `buy` charges the card the person saved, within the spending limits they set. Past those limits it returns a payment link: pass it to the user.
- Never ask for, print or store an agent key or card details. Don't write `NYMWELL_KEY` into files, commands or commits. If no key is set and the user wants you to buy, tell them they can create an agent key at https://nymwell.com/app/agents/ and export it in their own shell, or use the buy link.

## After buying

- `npx -y nymwell@0.1.0 order <order_id>` follows an order; `domains` lists their domains and `dns <domain>` shows the records (both need the key).
- To point the domain at a host such as Vercel, Netlify or Cloudflare Pages, the person can change DNS in the Nymwell console, or connect the account MCP server at https://nymwell.com/mcp/account, which can stage those records.

## Looking up an existing domain

`info <domain>` reads public records only: registrar, registration and expiry dates, lock status, DNS, MX/SPF/DMARC and HTTPS. It returns no owner contact details.

Availability and prices come live from the registrar (Name.com). More: https://nymwell.com/en/developers/
