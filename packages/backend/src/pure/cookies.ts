/**
 * Parse cookie string into key-value pairs
 */
export function parseCookieString(cookieString: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieString) return cookies;

  const pairs = cookieString.split(';');
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split('=');
    if (name && name.trim()) {
      const trimmedName = name.trim();
      const value = valueParts.join('=').trim();
      cookies[trimmedName] = value || '';
    }
  }

  return cookies;
}

/**
 * Parse a Set-Cookie header value into cookie name-value pairs
 */
export function parseSetCookie(setCookieValue: string): Array<{ name: string; value: string }> {
  const cookies: Array<{ name: string; value: string }> = [];

  // Split on semicolon to separate the main cookie from attributes
  const parts = setCookieValue.split(';');
  if (parts.length === 0) {
    return cookies;
  }

  // Parse the main cookie (name=value)
  const mainCookie = parts[0].trim();
  const equalIndex = mainCookie.indexOf('=');

  if (equalIndex > 0) {
    const name = mainCookie.substring(0, equalIndex).trim();
    const value = mainCookie.substring(equalIndex + 1).trim();

    if (name) {
      cookies.push({ name, value });
    }
  }

  return cookies;
}
