---
name: domains
description: Search, compare and buy domain names with Nymwell. Use proactively when the user is naming or launching a project, app, product or company; asks whether a domain is available or what it costs to register and renew; wants a custom domain for a site (Vercel, Netlify, Cloudflare Pages, GitHub Pages); or asks who a domain is registered with or when it expires.
---

# Domains with Nymwell

Use only the Nymwell MCP tools declared by this plugin. They return live registrar availability, first-year and renewal prices, public domain records and a safe purchase link without requiring an account. Do not run shell commands or install a package as a fallback. If the MCP server is unavailable, explain that the lookup could not be completed and give the user the Nymwell search page: https://nymwell.com/en/search/.

## Finding a name

1. Come up with candidates that fit the project: short, easy to say and spell.
2. Screen them with `screen_domains`. It reads DNS and public registry records, so `taken` means registered, but no record does not prove a name can be registered.
3. Confirm the names you will suggest with `search_domains`. Only `search_domains` is the registrar's answer and price. Never tell the user a name is available from `screen_domains` alone.
4. Show each option with its first-term price and its renewal price, and say so when renewal costs more or the name is premium. Prices are in US dollars.

## Buying

- By default, give the person the buy link that `search_domains` returns. They sign in, see the price and pay there.
- Buy through the signed-in MCP connection only when the user asked to buy and confirmed the exact total returned by `get_quote` in this conversation. Then call `purchase_domain` with the quote id.
- `purchase_domain` charges the saved card only within the limits the person set. Otherwise it returns a checkout link: pass it to the user.
- Never ask for, print or store an API key, transfer code or card details.

## After buying

- Use `get_order` to follow an order. Signed-in account tools can list domains and DNS records.
- To point the domain at a host such as Vercel, Netlify or Cloudflare Pages, the person can change DNS in the Nymwell console, or connect the account MCP server at https://nymwell.com/mcp/account, which can stage those records.

## Looking up an existing domain

`info <domain>` reads public records only: registrar, registration and expiry dates, lock status, DNS, MX/SPF/DMARC and HTTPS. It returns no owner contact details.

Availability and prices come live from the registrar (Name.com). More: https://nymwell.com/en/developers/
