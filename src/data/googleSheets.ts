/**
 * Fetch and parse Revenue Decomposition data from Google Sheets.
 * Sheet must be shared so "Anyone with the link can view" for CSV export to work.
 */

import { SPREADSHEET_ID } from '../config/sheets';
import type { ClientDetail } from './mockData';

const BASE_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=`;

/** Parse CSV string into rows and cells (handles quoted commas). */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cell += ch;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell.trim());
      cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}

/** Normalize number from cell (strip currency, spaces, parentheses; (1,234) = negative; supports trailing minus and Unicode minus). */
function parseNum(val: string): number {
  if (val == null || val === '') return NaN;
  let raw = String(val).trim();
  // Unicode minus (U+2212) and other hyphen-like chars → ASCII minus
  raw = raw.replace(/\u2212/g, '-').replace(/[\u2013\u2014]/g, '-');
  const trailingMinus = raw.endsWith('-');
  if (trailingMinus) raw = raw.slice(0, -1).trim();
  const negative = /^\([\d,.\s]+\)$/.test(raw) || raw.startsWith('-') || trailingMinus;
  const s = raw.replace(/[$€£,\s()]/g, '').replace(/[%\s]/g, '');
  const n = parseFloat(s);
  if (!isFinite(n)) return NaN;
  return negative ? -n : n;
}

/** Map sheet row labels to dashboard step labels (existing and new customers waterfall). */
const ROW_LABEL_TO_STEP: Record<string, string> = {
  'Plan': 'Plan',
  'Fixed fee diff.': 'Fixed fee difference',
  'Fixed fee diff': 'Fixed fee difference',
  'Fixed fee': 'Fixed fee difference',
  'Fixed fee difference': 'Fixed fee difference',
  'Volume impact': 'Volume',
  'Volume': 'Volume',
  'Price impact': 'Price',
  'Price': 'Price',
  'FX impact': 'FX',
  'FX': 'FX',
  'Timing': 'Timing',
  'Unknown churn': 'Unknown churn',
  'Churn': 'Unknown churn',
  'Residual': 'Residual',
  'Other': 'Residual',
  'Actual': 'Actual',
};

/** Step labels in display order (for sorting). */
const BRIDGE_STEP_ORDER = [
  'Plan', 'Fixed fee difference', 'Volume', 'Price', 'Timing', 'Unknown churn', 'FX', 'Residual', 'Actual',
];

export interface BridgeStepFromSheet {
  label: string;
  value: number;
  kind: 'total' | 'delta';
  clientDetails?: ClientDetail[];
  planFX?: number;
}

/** CORS proxy so the browser can load Google Sheets CSV when direct fetch is blocked. */
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

async function fetchCsvFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) return stripBom(await res.text());
  } catch {
    /* direct fetch failed (e.g. CORS), try proxy */
  }
  const proxyUrl = CORS_PROXY + encodeURIComponent(url);
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return stripBom(await res.text());
}

/**
 * Fetch a sheet tab as CSV by its full URL (e.g. "Publish to web" link). Prefer this when available – it usually works without a proxy.
 */
export async function fetchSheetCsvByUrl(url: string): Promise<string> {
  return fetchCsvFromUrl(url);
}

/**
 * Fetch a sheet tab as CSV by GID (export URL). Uses proxy if direct fetch is blocked.
 */
export async function fetchSheetCsv(gid: number): Promise<string> {
  const url = `${BASE_URL}${gid}`;
  return fetchCsvFromUrl(url);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function headerRowSomeMonth(row: string[]): boolean {
  const s = (row?.[1] ?? '').trim().toLowerCase();
  return /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(s) || s.startsWith('january') || s.startsWith('february');
}

/**
 * Parse waterfall sheet CSV into bridge steps.
 * Sheet layout: rows = steps (Plan, Fixed fee diff., Volume impact, ... Actual), first column = label, then columns = months (Jan..Dec) then TOTAL.
 * monthKey e.g. "2026-01" selects the January column, "2026-02" = February, etc.
 */
export function parseWaterfallCsv(csv: string, monthKey?: string): BridgeStepFromSheet[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];

  let dataCol = 1;
  let startRow = 0;

  if (monthKey) {
    const parts = monthKey.split('-');
    const monthNum = parts.length === 2 ? parseInt(parts[1], 10) : 0;
    if (monthNum >= 1 && monthNum <= 12) {
      const headerRow = rows[0] ?? [];
      const headerRow2 = (rows[1] ?? []).map((c: string) => (c ?? '').trim().toLowerCase());
      const monthNames: Record<number, RegExp[]> = {
        1: [/^january$/i, /^jan\b/i, /\/01\//, /^01\//],
        2: [/^february$/i, /^feb\b/i, /\/02\//, /^02\//],
        3: [/^march$/i, /^mar\b/i, /\/03\//, /^03\//],
        4: [/^april$/i, /^apr\b/i, /\/04\//, /^04\//],
        5: [/^may$/i, /\/05\//, /^05\//],
        6: [/^june$/i, /^jun\b/i, /\/06\//, /^06\//],
        7: [/^july$/i, /^jul\b/i, /\/07\//, /^07\//],
        8: [/^august$/i, /^aug\b/i, /\/08\//, /^08\//],
        9: [/^september$/i, /^sep\b/i, /\/09\//, /^09\//],
        10: [/^october$/i, /^oct\b/i, /\/10\//, /^10\//],
        11: [/^november$/i, /^nov\b/i, /\/11\//, /^11\//],
        12: [/^december$/i, /^dec\b/i, /\/12\//, /^12\//],
      };
      const regexes = monthNames[monthNum as keyof typeof monthNames] ?? [/jan/i];
      const findMonthCol = (row: string[]): number => {
        const idx = row.findIndex((c: string) => regexes.some(re => re.test((c ?? '').trim())));
        return idx;
      };
      let monthCol = findMonthCol(headerRow);
      if (monthCol < 0) monthCol = findMonthCol(headerRow2);
      if (monthCol >= 0) {
        dataCol = monthCol;
      } else {
        const janIdx = headerRow.findIndex((c: string) => /january|jan\b/i.test((c ?? '').trim()));
        if (janIdx >= 0) {
          dataCol = janIdx + (monthNum - 1);
        } else {
          dataCol = monthNum;
        }
      }
    }
  }

  const firstCell = (rows[0]?.[0] ?? '').trim().toLowerCase();
  if (rows.length > 1 && (firstCell === '' || /january|jan|february|feb|month/i.test(firstCell) || headerRowSomeMonth(rows[0] ?? []))) {
    startRow = 1;
  }

  const steps: BridgeStepFromSheet[] = [];
  const labelCols = [0, 1]; // try label in first column, then second (in case column A is empty)

  for (const labelCol of labelCols) {
    const valueCol = dataCol + labelCol; // data starts after label column(s)
    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      const labelCell = (row[labelCol] ?? '').trim();
      const normalizedLabel = ROW_LABEL_TO_STEP[labelCell] ?? ROW_LABEL_TO_STEP[labelCell.replace(/\.$/, '')];
      if (!normalizedLabel) continue;

      let value = parseNum(row[valueCol] ?? '');
      if (!isFinite(value) && row.length > valueCol + 1) value = parseNum(row[valueCol + 1] ?? '');
      if (!isFinite(value)) continue;

      if (!steps.some(s => s.label === normalizedLabel)) {
        const signAdjusted = (normalizedLabel === 'Residual' || normalizedLabel === 'Fixed fee difference') ? -value : value;
        steps.push({
          label: normalizedLabel,
          value: signAdjusted,
          kind: normalizedLabel === 'Plan' || normalizedLabel === 'Actual' ? 'total' : 'delta',
        });
      }
    }
    if (steps.length >= 2) break;
    steps.length = 0;
  }

  // If no steps found, try scan mode: find "Plan" and "January" anywhere in the grid
  if (steps.length === 0 && rows.length > 1) {
    let planRow = -1;
    let labelCol = 0;
    let janCol = -1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] ?? '').trim();
        if (/^plan$/i.test(cell)) {
          planRow = r;
          labelCol = c;
          break;
        }
      }
      if (planRow >= 0) break;
    }
    const monthNum = monthKey ? parseInt(monthKey.split('-')[1], 10) : 1;
    const monthRegexes: RegExp[] = [
      /january|^jan\b/i, /february|^feb\b/i, /march|^mar\b/i, /april|^apr\b/i,
      /^may\b/i, /june|^jun\b/i, /july|^jul\b/i, /august|^aug\b/i,
      /september|^sep\b/i, /october|^oct\b/i, /november|^nov\b/i, /december|^dec\b/i,
    ];
    const targetRe = monthRegexes[monthNum - 1] ?? /january|jan/i;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const cell = (row[c] ?? '').trim();
        if (targetRe.test(cell) || (monthNum === 1 && /^january$/i.test(cell))) {
          janCol = c;
          break;
        }
      }
      if (janCol >= 0) break;
    }
    if (janCol < 0) {
      const janIdx = rows[0]?.findIndex((c: string) => /^january$/i.test((c ?? '').trim())) ?? -1;
      janCol = janIdx >= 0 ? janIdx + (monthNum - 1) : monthNum;
    }
    const valueCol = janCol >= 0 ? janCol : 1;
    if (planRow >= 0) {
      for (let r = planRow; r < rows.length; r++) {
        const row = rows[r];
        const labelCell = (row[labelCol] ?? '').trim();
        const normalizedLabel = ROW_LABEL_TO_STEP[labelCell] ?? ROW_LABEL_TO_STEP[labelCell.replace(/\.$/, '')];
        if (!normalizedLabel) continue;
        let value = parseNum(row[valueCol] ?? '');
        if (!isFinite(value) && row.length > valueCol + 1) value = parseNum(row[valueCol + 1] ?? '');
        if (!isFinite(value)) continue;
        const signAdjusted = (normalizedLabel === 'Residual' || normalizedLabel === 'Fixed fee difference') ? -value : value;
        steps.push({
          label: normalizedLabel,
          value: signAdjusted,
          kind: normalizedLabel === 'Plan' || normalizedLabel === 'Actual' ? 'total' : 'delta',
        });
      }
    }
  }

  // Sort by bridge order so waterfall displays correctly
  const orderIdx = (label: string) => BRIDGE_STEP_ORDER.indexOf(label);
  steps.sort((a, b) => (orderIdx(a.label) >= 0 ? orderIdx(a.label) : 99) - (orderIdx(b.label) >= 0 ? orderIdx(b.label) : 99));
  return steps;
}

/**
 * Parse a breakdown sheet CSV into ClientDetail[].
 * Uses driverName to look for driver-specific columns (Volume, Price, Timing, Churn, FX); falls back to Plan/Actual/Variance.
 * Scans first few rows for header (sheet may have title or empty row 0).
 */
export function parseBreakdownCsv(csv: string, driverName: string): ClientDetail[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  let headerRow = 0;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r].map(h => (h || '').trim().toLowerCase());
    const hasClient = row.some(h => h === 'client' || h === 'client name' || h === 'customer');
    if (hasClient) {
      headerRow = r;
      break;
    }
  }
  const header = rows[headerRow].map(h => (h || '').trim().toLowerCase());
  const isChurn = driverName.toLowerCase().includes('churn');
  const clientCol = header.findIndex(h => h === 'client' || h === 'client name' || (isChurn && (h === 'customer' || h === 'name')));
  if (clientCol < 0) return [];

  const driver = driverName.toLowerCase();

  // Generic columns
  const revLocalCol = header.findIndex(h => h.includes('revenue') && h.includes('local'));
  const totalCol = header.findIndex(h => h === 'total');
  const planCol = header.findIndex(h => h === 'plan' || h === 'plan value' || h === 'plan volume' || h === 'plan price');
  const actualCol = header.findIndex(h => h === 'actual' || h === 'actual value' || h === 'actual volume' || h === 'actual price');
  const varCol = header.findIndex(h => h === 'variance' || h === 'var' || h.includes('revenue impact') || h.includes('impact') || h === 'contribution');
  const varPctCol = header.findIndex(h => (h.includes('variance') && h.includes('%')) || h === 'var %');
  // Churn sheets often use "Amount", "Value", or "Revenue" for the impact value
  const amountCol = isChurn ? header.findIndex(h => h === 'amount' || h === 'value' || (h.includes('revenue') && !h.includes('local'))) : -1;

  // Driver-specific columns
  const planVolumeCol = header.findIndex(h => h.includes('plan') && h.includes('volume'));
  const actualVolumeCol = header.findIndex(h => h.includes('actual') && h.includes('volume'));
  const planPriceCol = header.findIndex(h => h.includes('plan') && h.includes('price'));
  const actualPriceCol = header.findIndex(h => h.includes('actual') && h.includes('price'));
  const planDateCol = header.findIndex(h => h.includes('plan') && h.includes('date'));
  const actualDateCol = header.findIndex(h => h.includes('actual') && h.includes('date'));
  const daysDelayCol = header.findIndex(h => h.includes('delay') || h.includes('days'));
  const reasonCol = header.findIndex(h => h === 'reason' || h.includes('churn') || h.includes('reason'));
  // FX sheet uses "FX (Plan)" and "FX (Act)" – "act" is short for actual
  const planFxCol = header.findIndex(h => h.includes('plan') && (h.includes('fx') || h.includes('rate')));
  const actualFxCol = header.findIndex(h => (h.includes('actual') || (h.includes('fx') && h.includes('act'))) && (h.includes('fx') || h.includes('rate')));
  const fxChangeCol = header.findIndex(h => h.includes('fx change') || (h.includes('change') && h.includes('fx')));

  const valueCol = totalCol >= 0 ? totalCol : revLocalCol >= 0 ? revLocalCol : 1;
  const pCol = planCol >= 0 ? planCol : planVolumeCol >= 0 ? planVolumeCol : planPriceCol >= 0 ? planPriceCol : 1;
  const aCol = actualCol >= 0 ? actualCol : actualVolumeCol >= 0 ? actualVolumeCol : actualPriceCol >= 0 ? actualPriceCol : valueCol;

  // Revenue impact: prefer TOTAL column when present; fall back to Variance/Impact column; for churn also try Amount/Value
  const varianceCol = totalCol >= 0 ? totalCol : varCol >= 0 ? varCol : amountCol;

  const dataStartRow = headerRow + 1;
  const details: ClientDetail[] = [];
  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];
    const clientName = (row[clientCol] || '').trim();
    if (!clientName) continue;

    const planValue = parseNum(row[pCol] || '');
    const actualValue = parseNum(row[aCol] || '');
    let variance = varianceCol >= 0 ? parseNum(row[varianceCol] || '') : NaN;
    if (!isFinite(variance) && varCol >= 0) variance = parseNum(row[varCol] || '');
    if (!isFinite(variance) && amountCol >= 0) variance = parseNum(row[amountCol] || '');
    if (!isFinite(variance)) variance = (isFinite(actualValue) && isFinite(planValue) ? actualValue - planValue : parseNum(row[valueCol] || ''));
    const variancePct = varPctCol >= 0 ? parseNum(row[varPctCol] || '') / 100 : (planValue !== 0 && isFinite(variance) ? variance / Math.abs(planValue) : 0);

    const planVol = planVolumeCol >= 0 ? parseNum(row[planVolumeCol] || '') : (driver.includes('volume') ? planValue : NaN);
    const actualVol = actualVolumeCol >= 0 ? parseNum(row[actualVolumeCol] || '') : (driver.includes('volume') ? actualValue : NaN);
    const planP = planPriceCol >= 0 ? parseNum(row[planPriceCol] || '') : (driver.includes('price') ? planValue : NaN);
    const actualP = actualPriceCol >= 0 ? parseNum(row[actualPriceCol] || '') : (driver.includes('price') ? actualValue : NaN);

    const d: ClientDetail = {
      clientName,
      planValue: isFinite(planValue) ? planValue : 0,
      actualValue: isFinite(actualValue) ? actualValue : 0,
      variance: isFinite(variance) ? variance : 0,
      variancePct: isFinite(variancePct) ? variancePct : 0,
    };
    if (isFinite(planVol) || isFinite(actualVol)) {
      d.planVolume = isFinite(planVol) ? planVol : 0;
      d.actualVolume = isFinite(actualVol) ? actualVol : 0;
    }
    if (isFinite(planP) || isFinite(actualP)) {
      d.planPrice = isFinite(planP) ? planP : 0;
      d.actualPrice = isFinite(actualP) ? actualP : 0;
    }
    if (planDateCol >= 0) d.planDate = (row[planDateCol] || '').trim() || undefined;
    if (actualDateCol >= 0) d.actualDate = (row[actualDateCol] || '').trim() || undefined;
    if (daysDelayCol >= 0) {
      const delay = parseNum(row[daysDelayCol] || '');
      if (isFinite(delay)) d.daysDelay = delay;
    }
    if (reasonCol >= 0) d.churnReason = (row[reasonCol] || '').trim() || undefined;
    if (planFxCol >= 0 && driver.includes('fx')) {
      const rate = parseNum(row[planFxCol] || '');
      if (isFinite(rate)) d.planFxRate = rate;
    }
    if (actualFxCol >= 0) {
      const rate = parseNum(row[actualFxCol] || '');
      if (isFinite(rate)) d.fxRate = rate;
    }
    if (fxChangeCol >= 0) {
      const ch = parseNum(row[fxChangeCol] || '');
      if (isFinite(ch)) d.fxChange = ch;
    } else if (planFxCol >= 0 && actualFxCol >= 0 && driver.includes('fx')) {
      const planRate = parseNum(row[planFxCol] || '');
      const actualRate = parseNum(row[actualFxCol] || '');
      if (isFinite(planRate) && isFinite(actualRate)) d.fxChange = actualRate - planRate;
    }
    details.push(d);
  }

  return details.filter(d => d.clientName && (isFinite(d.variance) || isFinite(d.actualValue) || isFinite(d.planValue)));
}

/**
 * Parse Fixed fee breakdown sheet (GID 1244747177). Sheet has month blocks: each month has columns
 * Client, Currency, Revenue component, Amount (Act), Amount (Plan), TOTAL, Comment.
 * monthKey "2026-01" = show January block only.
 */
export function parseFixedFeeBreakdownCsv(csv: string, monthKey: string): ClientDetail[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const monthNum = monthKey ? parseInt(monthKey.split('-')[1], 10) : 1;
  if (!(monthNum >= 1 && monthNum <= 12)) return [];

  // Find header row: has "Client" and ("Amount (Act)" or "TOTAL")
  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r].map(c => (c ?? '').trim().toLowerCase());
    const hasClient = row.some(c => c === 'client');
    const hasAmountAct = row.some(c => c.includes('amount') && c.includes('act'));
    const hasTotal = row.some(c => c === 'total');
    if (hasClient && (hasAmountAct || hasTotal)) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) return [];

  const header = rows[headerRow].map(c => (c ?? '').trim());
  const dateRow = headerRow > 0 ? rows[headerRow - 1].map(c => (c ?? '').trim()) : [];
  // Find block for our month: columns where header is "Client"; row above has date (31/01/2028, January, etc.)
  const clientCols = header.map((h, i) => ((h || '').toLowerCase() === 'client' ? i : -1)).filter(i => i >= 0);
  let blockStart = -1;
  for (const c of clientCols) {
    const dateCell = (dateRow[c] ?? '').trim().toLowerCase();
    const isJan = /january|jan\b|31\/01|01\/01|\/01\/|^01\//.test(dateCell);
    const isFeb = /february|feb\b|28\/02|02\/02|\/02\/|^02\//.test(dateCell);
    if ((monthNum === 1 && isJan) || (monthNum === 2 && isFeb)) {
      blockStart = c;
      break;
    }
  }
  if (blockStart < 0 && clientCols.length > 0) blockStart = clientCols[monthNum === 2 ? Math.min(1, clientCols.length - 1) : 0];
  if (blockStart < 0) return [];

  // Columns: Client, Currency, Revenue component, Amount (Act), Amount (Plan), TOTAL, Comment
  const clientCol = blockStart;
  const currencyCol = blockStart + 1;
  const revenueComponentCol = blockStart + 2;
  const amountActCol = blockStart + 3;
  const amountPlanCol = blockStart + 4;
  const totalCol = blockStart + 5;
  const commentCol = blockStart + 6;

  const details: ClientDetail[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const clientName = (row[clientCol] ?? '').trim();
    if (!clientName) continue;

    const planValue = parseNum(row[amountPlanCol] ?? '');
    const actualValue = parseNum(row[amountActCol] ?? '');
    const variance = parseNum(row[totalCol] ?? '');
    const variancePct = isFinite(planValue) && planValue !== 0 ? (isFinite(variance) ? variance / Math.abs(planValue) : 0) : 0;

    details.push({
      clientName,
      planValue: isFinite(planValue) ? planValue : 0,
      actualValue: isFinite(actualValue) ? actualValue : 0,
      variance: isFinite(variance) ? variance : 0,
      variancePct: isFinite(variancePct) ? variancePct : 0,
      currency: (row[currencyCol] ?? '').trim() || undefined,
      revenueComponent: (row[revenueComponentCol] ?? '').trim() || undefined,
      comment: (row[commentCol] ?? '').trim() || undefined,
    });
  }
  return details.filter(d => d.clientName);
}

/**
 * Parse Unknown churn breakdown sheet. Same layout as Fixed fee: month blocks with date in row above,
 * columns: Client, Currency, Revenue component, Amount (Act), Amount (Plan), TOTAL, Comment.
 */
export function parseChurnBreakdownCsv(csv: string, monthKey: string): ClientDetail[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];

  const monthNum = monthKey ? parseInt(monthKey.split('-')[1], 10) : 1;
  if (!(monthNum >= 1 && monthNum <= 12)) return [];

  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r].map(c => (c ?? '').trim().toLowerCase());
    const hasClient = row.some(c => c === 'client');
    const hasTotal = row.some(c => c === 'total');
    const hasAmount = row.some(c => c.includes('amount'));
    if (hasClient && (hasTotal || hasAmount)) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) return [];

  const header = rows[headerRow].map(c => (c ?? '').trim());
  const dateRow = headerRow > 0 ? rows[headerRow - 1].map(c => (c ?? '').trim()) : [];
  const clientCols = header.map((h, i) => ((h || '').toLowerCase() === 'client' ? i : -1)).filter(i => i >= 0);
  let blockStart = -1;
  for (const c of clientCols) {
    const dateCell = (dateRow[c] ?? '').trim().toLowerCase();
    const isJan = /january|jan\b|31\/01|01\/01|\/01\/|^01\//.test(dateCell);
    const isFeb = /february|feb\b|28\/02|02\/02|\/02\/|^02\//.test(dateCell);
    const isMar = /march|mar\b|31\/03|03\/03|\/03\/|^03\//.test(dateCell);
    if ((monthNum === 1 && isJan) || (monthNum === 2 && isFeb) || (monthNum === 3 && isMar)) {
      blockStart = c;
      break;
    }
  }
  if (blockStart < 0 && clientCols.length > 0) blockStart = clientCols[Math.min(monthNum - 1, clientCols.length - 1)];
  if (blockStart < 0) return [];

  // Churn: Client, Currency, Revenue component, Amount (Act), Amount (Plan), TOTAL, Comment
  const clientCol = blockStart;
  const currencyCol = blockStart + 1;
  const revenueComponentCol = blockStart + 2;
  const amountActCol = blockStart + 3;
  const amountPlanCol = blockStart + 4;
  const totalCol = blockStart + 5;
  const commentCol = blockStart + 6;

  const details: ClientDetail[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const rowData = rows[r];
    const clientName = (rowData[clientCol] ?? '').trim();
    if (!clientName) continue;

    const planValue = parseNum(rowData[amountPlanCol] ?? '');
    const actualValue = parseNum(rowData[amountActCol] ?? '');
    const variance = parseNum(rowData[totalCol] ?? '');
    const plan = isFinite(planValue) ? planValue : NaN;
    const actual = isFinite(actualValue) ? actualValue : NaN;
    const variancePct = plan !== 0 && isFinite(plan) ? (isFinite(variance) ? variance / Math.abs(plan) : 0) : 0;

    details.push({
      clientName,
      planValue: plan,
      actualValue: actual,
      variance: isFinite(variance) ? variance : 0,
      variancePct: isFinite(variancePct) ? variancePct : 0,
      currency: (rowData[currencyCol] ?? '').trim() || undefined,
      revenueComponent: (rowData[revenueComponentCol] ?? '').trim() || undefined,
      churnReason: (rowData[commentCol] ?? '').trim() || undefined,
    });
  }
  return details.filter(d => d.clientName);
}

/** Insight for Key Insights & Highlights section */
export interface InsightFromSheet {
  type: 'positive' | 'negative';
  text: string;
}

/**
 * Insights sheet layout (GID 1794114721):
 * - Column E (index 4): Positive comments, starting row 10 (E10, E11, E12...)
 * - Column F (index 5): Negative comments, starting row 10 (F10, F11, F12...)
 */
const INSIGHTS_POS_COL = 4;  // E
const INSIGHTS_NEG_COL = 5;  // F
const INSIGHTS_START_ROW = 9; // 0-based (row 10 in sheet)

export function parseInsightsCsv(csv: string): InsightFromSheet[] {
  const rows = parseCsv(csv);
  const insights: InsightFromSheet[] = [];

  const isSheetError = (s: string) => /^#(REF!|VALUE!|N\/A|NULL!|DIV\/0!|NAME\?)$/i.test(s.trim());

  for (let r = INSIGHTS_START_ROW; r < rows.length; r++) {
    const row = rows[r];
    const posText = (row[INSIGHTS_POS_COL] ?? '').trim();
    const negText = (row[INSIGHTS_NEG_COL] ?? '').trim();

    if (posText && posText.length >= 2 && !isSheetError(posText)) {
      insights.push({ type: 'positive', text: posText });
    }
    if (negText && negText.length >= 2 && !isSheetError(negText)) {
      insights.push({ type: 'negative', text: negText });
    }
  }

  return insights;
}
