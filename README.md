# Caido Param Logger

Caido Param Logger is a Caido plugin concept for turning observed HTTP traffic into a searchable parameter map.

The current product direction is captured directly in [`preview.html`](preview.html). Open that file in a browser to see the intended plugin experience: a Caido-style workspace with a target tree, parameter table, location filters, interesting/new flags, a detail drawer, request actions, and wordlist export.

## What It Does

The plugin passively watches traffic that already exists in Caido and answers the questions testers keep asking during manual review:

- What parameters have appeared across this target?
- Where did each parameter appear: query string, path, JSON body, form body, headers, or cookies?
- Which domains, endpoints, and HTTP methods use a parameter?
- Which path segments and body fields look dynamic?
- Which parameters are new, sensitive-looking, redirect-related, file/path-related, or authorization-relevant?
- Which observed names should be exported for follow-up testing with wordlists, fuzzers, Param Miner, or custom workflows?

It is not meant to replace active discovery tools. It builds a reliable passive inventory from traffic that has already been seen, then makes that knowledge fast to browse, filter, inspect, and export.

## Preview-Driven Design

[`preview.html`](preview.html) is the reference for how the plugin should work and feel.

The plugin should preserve the main interaction model from the preview:

- A global search for parameters, endpoints, domains, value types, and flags.
- A left-side tree grouped by domain, then endpoint pattern and method.
- A central parameter table optimized for quick triage.
- Location filters for query, JSON, form, header, cookie, and path parameters.
- Toggle filters for interesting parameters and newly observed parameters.
- Row-level actions for copying names and replaying/opening related requests.
- A detail drawer showing parameter metadata, redacted example values, dynamic confidence, flags, and example requests.
- A wordlist export action that exports the current filtered parameter names.
- A live status bar showing that traffic is being parsed.

In short: the preview is not just a mockup. It is the MVP user experience.

## Core Workflow

1. Browse or replay application traffic in Caido.
2. The plugin parses historical and newly observed requests.
3. Parameters are extracted, normalized, classified, and grouped.
4. The tester opens the inventory view and filters by target, endpoint, location, flag, or search text.
5. Interesting items can be inspected in the drawer, copied, exported, replayed, or sent into the next Caido workflow.

The default view should be useful immediately after passive browsing: domains on the left, parameters in the middle, details on demand.

## What Gets Parsed

The inventory should extract parameters and dynamic fields from:

- Query string parameters.
- REST-style path segments.
- JSON request bodies, including nested fields.
- `application/x-www-form-urlencoded` bodies.
- Multipart form field names.
- Selected request headers.
- Cookies.
- GraphQL operation names and variables, where practical.

Nested JSON fields should be flattened into field paths.

```json
{
  "user": {
    "email": "person@example.com",
    "roles": ["admin"]
  }
}
```

Produces:

```text
user.email
user.roles[]
```

## What Gets Tracked

A parameter is a unique observed item keyed by:

- Domain.
- HTTP method.
- Normalized endpoint pattern.
- Location.
- Name or field path.

Example:

```text
api.example.com | POST | /users/{id}/settings | json | notifications.email
```

Each parameter should track:

- First seen and last seen.
- Request count.
- Value type.
- Dynamic confidence.
- Interesting flags.
- Redacted example values.
- Example request references.

## Endpoint Normalization

Dynamic path segments should be normalized into reusable endpoint patterns.

```text
/users/123/orders
/users/456/orders
```

Becomes:

```text
/users/{number}/orders
```

And:

```text
/projects/550e8400-e29b-41d4-a716-446655440000
```

Becomes:

```text
/projects/{uuid}
```

The preview represents these as path parameters such as `{id}` and `{uuid}` so they can be searched, flagged, and inspected like any other parameter.

## Classification

Observed values should be classified when possible:

- Empty.
- Boolean.
- Integer.
- Decimal.
- String.
- Email.
- URL.
- UUID.
- JWT.
- Base64-like value.
- Hash-like value.
- Timestamp or date.
- Array or object.
- Binary.
- Unknown.

Dynamic confidence should be based on repeated observations, value variety, and known dynamic formats such as UUIDs, JWTs, hashes, timestamps, numeric IDs, and URLs. The UI should present this as a confidence signal, not an absolute truth.

## Interesting Flags

The preview uses compact flags to keep triage fast. The first implementation should support:

- `new`: first seen in the current session or since the last baseline.
- `sensitive`: names or values that look security-relevant, such as tokens, secrets, passwords, sessions, debug flags, or admin controls.
- `redirect`: redirect and callback style parameters such as `redirect_uri`, `return_url`, `next`, `callback`, and `url`.
- `file`: file and path style parameters such as `file`, `path`, `folder`, `template`, and `include`.
- `auth`: authorization or tenant-boundary parameters such as `role`, `user_id`, `account_id`, `tenant_id`, `org_id`, and permission fields.
- `dynamic`: path segments or values that appear request-specific, user-specific, or otherwise variable.

Custom target-specific rules can come later, but the default flags should make common security review paths visible immediately.

## MVP Scope

The first useful version should implement the workflow shown in [`preview.html`](preview.html):

- Parse historical Caido traffic if the plugin API allows it.
- Parse newly observed requests.
- Extract query, path, JSON, form, header, and cookie parameters.
- Normalize endpoint patterns.
- Flatten nested JSON fields.
- Track first seen, last seen, request count, value type, dynamic confidence, flags, redacted examples, and example request references.
- Render the domain/endpoint tree.
- Render the searchable, filterable parameter table.
- Render the detail drawer.
- Link parameters back to example requests in Caido.
- Copy parameter names.
- Export filtered unique parameter names as a wordlist.

MVP does not need active attacks, perfect endpoint normalization, complex scoring, or a full schema generator.

## Data Model Draft

### Domain

```text
id
hostname
scheme
port
first_seen
last_seen
request_count
```

### Endpoint

```text
id
domain_id
method
normalized_path
raw_path_examples
first_seen
last_seen
request_count
```

### Parameter

```text
id
domain_id
endpoint_id
method
location
name
normalized_name
value_types
interesting_flags
dynamic_confidence
first_seen
last_seen
request_count
unique_value_count
example_request_ids
redacted_examples
```

### Observation

```text
id
parameter_id
request_id
raw_name
raw_value_redacted
value_type
observed_at
```

## Security And Privacy

The plugin will inspect sensitive traffic, so storage and display should be conservative by default.

Important requirements:

- Redact or truncate sensitive values by default.
- Avoid storing full tokens, secrets, passwords, authorization headers, or session cookies unless explicitly enabled.
- Let users configure excluded headers, cookies, parameters, and domains.
- Make exports explicit and user-controlled.
- Prefer storing value shapes and small examples over raw sensitive data.

Default redaction candidates:

- `authorization`
- `cookie`
- `set-cookie`
- `password`
- `passwd`
- `secret`
- `token`
- `api_key`
- `apikey`
- `key`
- `session`

## Future Ideas

After the preview-backed MVP works, useful extensions include:

- Session comparison and per-target baselines.
- User-defined classification and highlighting rules.
- JSON and CSV exports.
- Export by domain, endpoint, location, or flag.
- Integration with active parameter discovery tools.
- Send selected parameters to Caido workflows.
- Risk scoring for parameters.
- Graph view of domains, endpoints, and shared parameters.
- OpenAPI-like schema approximation.
- GraphQL-specific operation and variable inventory.
- WebSocket message parameter parsing.
- Response analysis to connect request parameters with reflected response fields.

## Success Criteria

The plugin is successful when a tester can open Caido after browsing an application and immediately understand the target's parameter surface.

A useful first version should let the tester:

- See domains and normalized endpoint patterns.
- Search parameters by name, endpoint, value type, or flag.
- Spot new, sensitive-looking, redirect-like, file-like, auth-related, and dynamic parameters.
- Open a parameter and understand where it appeared.
- Jump back to example requests.
- Export observed parameter names for further testing.

## Name

The working name is **Caido Param Logger**. The preview uses the shorter UI label **Param Logger**.
