/**
 * Google Sheets configuration for Revenue Decomposition dashboard.
 * Prefer "Publish to web" URLs when available (File → Share → Publish to web → CSV); they work reliably from the browser.
 */

export const SPREADSHEET_ID = '13w52HilUuF_a59al07j-TDdMLdhtWATf';

/**
 * "Publish to web" CSV URLs (one per waterfall sheet). Use these when set – they avoid CORS issues.
 * Create via: File → Share → Publish to web → Link → CSV for the specific sheet.
 */
export const PUB_WATERFALL_URLS: Partial<Record<'existing-clients' | 'new-clients', string>> = {
  'existing-clients': 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSw3yxyTz0GnBdozAE-hfo3M9NIg41hjRqDx6x-cz6da2YpklP55op6IfBGITX9EA/pub?output=csv',
  // 'new-clients': '<paste your new-clients publish-to-web CSV URL here>',
};

/** GID for the waterfall (summary) tab per client type – used when no PUB_WATERFALL_URL is set */
export const WATERFALL_GIDS = {
  'existing-clients': 1337211933,
  'new-clients': 1735828162,
} as const;

/**
 * GIDs for client-level breakdown tabs. When user clicks a waterfall bar,
 * we fetch the corresponding breakdown sheet by this GID.
 */
export const BREAKDOWN_GIDS = {
  'existing-clients': {
    'Fixed fee difference': 1244747177,
    'Volume': 1433785023,
    'Price': 134153611,
    'FX': 245913021,
    'Timing': 2012839381,
    'Unknown churn': 861067963,
  },
  'new-clients': {
    'Fixed fee difference': 634736315,
    'Volume': 1506044197,
    'Price': 1987511416,
    'FX': 2010390439,
    'Timing': 329084365,
    'Unknown churn': 755512218,
  },
} as const;

export type ClientType = keyof typeof BREAKDOWN_GIDS;

/** Step labels that have a breakdown tab (used for bar click → fetch) */
export const STEP_LABELS_WITH_BREAKDOWN = [
  'Fixed fee difference',
  'Volume',
  'Price',
  'FX',
  'Timing',
  'Unknown churn',
] as const;

/** GID for insights sheet (positive and negative comments) */
export const INSIGHTS_GID = 874758246;

/** Map any step label (e.g. "Volume impact") to BREAKDOWN_GIDS key for lookup */
export const STEP_LABEL_TO_BREAKDOWN_KEY: Record<string, string> = {
  'Fixed fee difference': 'Fixed fee difference',
  'Volume': 'Volume',
  'Volume impact': 'Volume',
  'Price': 'Price',
  'Price impact': 'Price',
  'FX': 'FX',
  'FX impact': 'FX',
  'Timing': 'Timing',
  'Unknown churn': 'Unknown churn',
};
