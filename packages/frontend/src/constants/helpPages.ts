export const HELP_PAGES = [
  {
    title: 'Welcome to Param Logger',
    subtitle: 'Introduction',
    image: new URL('../assets/help/preview.png', import.meta.url).href,
    body: [
      'Param Logger watches your Caido HTTP history in the background and builds a deduplicated inventory of every parameter the target accepts.',
      'Each parameter is classified by value type, flagged for security-relevant patterns, and scored by risk so the most interesting candidates surface first.',
      'Use this guide to learn how each part of the interface works.',
    ],
  },
  {
    title: 'Targets',
    subtitle: 'Domain & endpoint tree',
    image: new URL('../assets/help/targets.png', import.meta.url).href,
    body: [
      'The left tree groups parameters by domain and endpoint, so you can scope the table to a single host or route.',
      'Click a domain to filter; expand it to drill into individual endpoints. The badge shows the unique parameter count for that node.',
      'Use the search box at the top to jump to a specific host or path.',
    ],
  },
  {
    title: 'Parameters',
    subtitle: 'The main inventory table',
    image: new URL('../assets/help/params.png', import.meta.url).href,
    body: [
      'The table lists every unique parameter Param Logger has captured, with its location, endpoint, detected value type, flags, and risk score.',
      'Flags are assigned by name pattern, value content, and location. For example, names like `redirect`, `next`, or `url` get the redirect flag; values that parse as a JWT get the jwt value type; numeric or UUID values on auth-related names get idor.',
      'The risk score (0 to 100) combines flag severity, value type sensitivity, and observation count. Rows sort by score, so use it to prioritise which parameters to investigate first.',
    ],
  },
  {
    title: 'Details',
    subtitle: 'Parameter deep-dive drawer',
    image: new URL('../assets/help/detail.png', import.meta.url).href,
    body: [
      'Clicking a row opens the drawer with full metadata: location, endpoint, value type, observation count, and timestamps.',
      '"Things to check" is a context-aware list of hints based on the parameter\'s flags, value type, and location, suggesting concrete tests you can run against it.',
      'From the footer, jump to Caido Search filtered to matching requests, send the latest request to Replay, or create a Finding linked to the parameter.',
    ],
  },
  {
    title: 'Filtering & Search',
    subtitle: 'Narrowing down results',
    image: new URL('../assets/help/filters.png', import.meta.url).href,
    body: [
      'The filter bar narrows the table by location, security flag, or value type. Filters and tree selection compose, so combine them to slice the inventory precisely.',
      'The global header search matches names, endpoints, domains, value types, and flags at once. Press / to focus it from anywhere.',
    ],
  },
] as const;