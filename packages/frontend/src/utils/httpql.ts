import type { Parameter } from '@param-logger/shared';
import { ParameterLocation } from '@param-logger/shared';

/**
 * Escape a literal string for embedding inside a double-quoted HTTPQL value
 * (backslashes and double quotes need escaping).
 */
export function escapeHttpQLString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Escape a literal string so it can be embedded inside a Rust-flavoured regex
 * (used by HTTPQL `regex`/`nregex` operators) and matched as plain text.
 */
export function escapeRegexLiteral(s: string): string {
  return s.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&');
}

/**
 * Build a Rust-flavoured regex that matches exactly the parameter's normalized
 * path, treating placeholders like `{id}`, `{uuid}`, `{hash}` as a single
 * path segment (`[^/]+`). Anchored with `^…$` so we don't pick up sibling or
 * child endpoints the way `req.path.cont` did.
 *
 * An optional trailing `/?` is appended (except for the bare root `/`) so that
 * a path Caido stores with a trailing slash (e.g. `/api/`) still matches the
 * normalised form `/api` that the inventory records. `normalizePath` always
 * strips trailing slashes, so without this the HTTPQL query returns 0 results
 * for any endpoint whose path ends with `/`.
 */
export function buildPathRegex(normalizedPath: string): string {
  const segments = normalizedPath.split('/');
  const escapedSegments = segments.map((segment) => {
    if (segment.length === 0) return '';
    if (/^\{[^}]+\}$/.test(segment)) {
      return '[^/]+';
    }
    return escapeRegexLiteral(segment);
  });
  const joined = escapedSegments.join('/');
  return joined === '/' ? '^/$' : `^${joined}/?$`;
}

/**
 * Return the leaf key of a flattened JSON parameter name, i.e. the segment that
 * will actually appear (quoted) in the raw JSON body. The parser produces names
 * like `user.name`, `users[].name`, `data.items[0].id` — only the last key is
 * present in the body, so that's what we match against.
 */
export function jsonLeafKey(name: string): string {
  let s = name.replace(/\[\d*\]+$/, '');
  const dotIdx = s.lastIndexOf('.');
  if (dotIdx >= 0) s = s.slice(dotIdx + 1);
  s = s.replace(/\[\d*\]$/, '');
  return s;
}

/**
 * Build an HTTPQL query that scopes Search to requests carrying this
 * parameter. The query is intentionally conservative: every clause is anchored
 * (regex or exact-match) so the count in Search agrees with the
 * per-parameter `count` we display in the inventory.
 */
export function buildHttpQLForParameter(p: Parameter): string {
  const parts: string[] = [];

  // Host. Caido's `req.host` is the raw `Host:` header value, which may include
  // a `:<port>` suffix. Match either form, case-insensitively (hostnames are
  // case-insensitive per RFC 3986), so a request to `Example.com:8080` still
  // resolves to a parameter we stored under `example.com`.
  parts.push(
    `req.host.regex:"${escapeHttpQLString(`(?i)^${escapeRegexLiteral(p.domain)}(?::\\d+)?$`)}"`,
  );

  parts.push(`req.method.eq:"${escapeHttpQLString(p.method)}"`);

  // Path: anchored regex with placeholders → `[^/]+`, so an inventory row for
  // `/api/users/{id}/profile` doesn't also match `/api/users` or
  // `/api/users/123/settings` the way `req.path.cont:"/api/users"` did.
  parts.push(
    `req.path.regex:"${escapeHttpQLString(buildPathRegex(p.normalizedPath))}"`,
  );

  switch (p.location) {
    case ParameterLocation.QUERY: {
      // `req.query` excludes the leading `?`, so a parameter at the start of
      // the query string has nothing before it, and any other parameter is
      // preceded by `&`. Anchor accordingly so `id` doesn't match `userid`.
      const nameLit = escapeRegexLiteral(p.name);
      parts.push(
        `req.query.regex:"${escapeHttpQLString(`(?:^|&)${nameLit}=`)}"`,
      );
      break;
    }
    case ParameterLocation.FORM:
      // Use case-insensitive substring matching (`cont`) instead of `regex`
      // on `req.raw`. The `regex` operator can return 0 results for requests
      // where the raw bytes aren't stored as searchable text (e.g. HTTP/2
      // traffic with HPACK-compressed headers). `cont` uses a different
      // search path that is more reliable. The host + method + path clauses
      // already constrain the result set, so the precision loss is minimal.
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`${p.name}=`)}"`,
      );
      break;
    case ParameterLocation.JSON: {
      // Match the quoted JSON key name. `cont` is more reliable than `regex`
      // on `req.raw` (see FORM comment above).
      const leaf = jsonLeafKey(p.name);
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`"${leaf}"`)}"`,
      );
      break;
    }
    case ParameterLocation.MULTIPART:
      // Match the Content-Disposition field name.
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`name="${p.name}"`)}"`,
      );
      break;
    case ParameterLocation.HEADER:
      // Match "HeaderName:" substring. `cont` is case-insensitive which
      // covers both HTTP/1.1 mixed-case and HTTP/2 lower-cased header names.
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`${p.name}:`)}"`,
      );
      break;
    case ParameterLocation.COOKIE:
      // Match "cookieName=" substring. Using `cont` instead of `regex` on
      // `req.raw` avoids the 0-result issue where req.raw.regex fails to
      // search within Cookie headers (observed with HTTP/2 traffic where raw
      // bytes aren't indexed as searchable text for the regex operator).
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`${p.name}=`)}"`,
      );
      break;
    case ParameterLocation.PATH:
      // The path regex above already constrains this case exactly.
      break;
  }

  return parts.join(' AND ');
}