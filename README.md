# Param Logger

A Caido plugin that builds a searchable parameter inventory from your HTTP traffic.

## What It Does

As you browse or replay requests in Caido, Param Logger extracts every parameter it sees and organizes it by domain and endpoint. The result is a filterable table showing what parameters exist, where they appear, what kind of values they carry, and which ones are worth a closer look.

It also scans your existing Caido request history on startup so the inventory is populated immediately, not just from new traffic.

## What It Extracts

- Query string parameters
- Path segments (e.g. `/users/123` becomes `/users/{number}`)
- JSON body fields, including nested ones flattened to dot-paths (`user.roles[]`)
- Form-encoded body fields
- Multipart form field names
- Cookies
- Selected request headers

## How to Read the Table

Each row is a unique parameter observed at a specific location on a specific endpoint. Columns:

| Column | Description |
|---|---|
| Parameter | The parameter or field name |
| Location | Where it appeared: `query`, `json`, `form`, `path`, `header`, `cookie` |
| Endpoint | HTTP method + normalized path pattern |
| Value type | Detected value shape: `jwt`, `uuid`, `email`, `url`, `base64`, `hash`, `integer`, `boolean`, etc. |
| Flags | `sensitive`, `auth`, `redirect`, `file`, `new` |

## Flags

- **sensitive** — names that look like tokens, secrets, passwords, session IDs, debug controls
- **auth** — names that look like user/tenant/permission boundaries (`user_id`, `role`, `org_id`, etc.)
- **redirect** — names used for open redirect and SSRF patterns (`redirect_uri`, `next`, `callback`, etc.)
- **file** — names that suggest path or file inclusion (`path`, `file`, `template`, `include`, etc.)
- **new** — parameters observed for the first time in this session

## Filtering

Use the filter bar to narrow the table by location, flag, or value type. Use the search box to match against parameter names, endpoints, and domains. Click a domain or endpoint in the left tree to scope the view.

## Actions

- Click any row to open a detail drawer with example values and the requests it was seen in.
- From the drawer, jump directly to an example request in Caido HTTP History.
- Use **Export wordlist** to copy the current filtered parameter names as a plain list for use in Param Miner, ffuf, or other tools.
- Use **↻ Rescan** to clear the inventory and rebuild it from scratch from the current project's traffic.

## Scope

The inventory is per-project. Switching Caido projects clears and rebuilds the inventory automatically.
