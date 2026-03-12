/**
 * Revenue data service: tries Google Sheets first, falls back to mock data.
 */

import type { RevenueData } from './mockData';
import { generateRevenueData } from './mockData';
import { WATERFALL_GIDS, PUB_WATERFALL_URLS, BREAKDOWN_GIDS, STEP_LABELS_WITH_BREAKDOWN } from '../config/sheets';
import type { ClientType } from '../config/sheets';
import { fetchSheetCsv, fetchSheetCsvByUrl, parseWaterfallCsv, parseBreakdownCsv, parseFixedFeeBreakdownCsv } from './googleSheets';

const BRIDGE_ORDER = ['Plan', 'Fixed fee difference', 'Volume', 'Price', 'Timing', 'Unknown churn', 'FX', 'Residual', 'Actual'];

/** Months we have sheet data for (must match Sidebar MONTHS_AVAILABLE). */
const AVAILABLE_MONTH_KEYS = ['2026-01', '2026-02'];

/** Get month keys to aggregate for quarterly or annual view (subset of AVAILABLE_MONTH_KEYS). */
function getMonthsToAggregate(viewType: 'quarterly-cumulative' | 'annual-cumulative', selectedMonth: string): string[] {
  const [year, monthStr] = selectedMonth.split('-').map(Number);
  if (viewType === 'annual-cumulative') {
    return AVAILABLE_MONTH_KEYS.filter(m => m.startsWith(String(year)));
  }
  // quarterly-cumulative: Q1 = 1,2,3; Q2 = 4,5,6; etc. Keep only available months in that quarter
  const quarterStart = Math.floor((monthStr - 1) / 3) * 3 + 1;
  const quarterMonths = [quarterStart, quarterStart + 1, quarterStart + 2];
  return AVAILABLE_MONTH_KEYS.filter(mk => {
    const m = parseInt(mk.split('-')[1], 10);
    return mk.startsWith(String(year)) && quarterMonths.includes(m);
  });
}

/** Build RevenueData from waterfall steps only (plan/actual from first/last step; drivers from deltas). */
function buildRevenueDataFromSteps(
  steps: Array<{ label: string; value: number; kind: 'total' | 'delta' }>
): RevenueData {
  const planRec = steps.find(s => s.label === 'Plan')?.value ?? 0;
  const actual = steps.find(s => s.label === 'Actual')?.value ?? 0;
  const variance = actual - planRec;
  const planFX = 1.0;
  const actualFX = 1.0;

  const byOrder = (a: { label: string }, b: { label: string }) =>
    BRIDGE_ORDER.indexOf(a.label) - BRIDGE_ORDER.indexOf(b.label);
  const orderedSteps = [...steps].sort(byOrder);

  const bridgeSteps = orderedSteps.map(s => ({
    label: s.label,
    value: s.value,
    kind: s.kind,
    planFX: s.label === 'FX' ? planFX : undefined,
  }));

  const drivers = steps
    .filter(s => s.kind === 'delta' && s.label !== 'Plan' && s.label !== 'Actual')
    .map(s => ({
      name: s.label,
      value: s.value,
      note: `${s.label} contribution to variance`,
    }));

  return {
    planRec,
    actual,
    variance,
    varPct: planRec !== 0 ? variance / planRec : 0,
    planDelay: 0.08,
    actualDelay: 0.08,
    planFX,
    actualFX,
    drivers,
    bridgeSteps,
    insights: [],
  };
}

export type DataSource = 'sheet' | 'mock';

/**
 * Load revenue data: try Google Sheets waterfall for the given client type, then fall back to mock.
 * For quarterly/annual view, aggregates the available months (e.g. Jan + Feb) from the sheet.
 */
export async function loadRevenueData(
  month: string,
  clientType: ClientType,
  viewType: 'monthly' | 'quarterly-cumulative' | 'annual-cumulative'
): Promise<{ data: RevenueData; source: DataSource }> {
  const gid = WATERFALL_GIDS[clientType];
  const pubUrl = PUB_WATERFALL_URLS[clientType];

  const tryLoadMonthly = (csv: string, monthKey: string): Promise<{ data: RevenueData; source: DataSource } | null> => {
    const steps = parseWaterfallCsv(csv, monthKey);
    if (steps.length >= 2) {
      return Promise.resolve({ data: buildRevenueDataFromSteps(steps), source: 'sheet' as DataSource });
    }
    return Promise.resolve(null);
  };

  const tryLoadCumulative = (csv: string, view: 'quarterly-cumulative' | 'annual-cumulative'): Promise<{ data: RevenueData; source: DataSource } | null> => {
    const monthKeys = getMonthsToAggregate(view, month);
    if (monthKeys.length === 0) return Promise.resolve(null);
    const allSteps = monthKeys.map(mk => parseWaterfallCsv(csv, mk)).filter(s => s.length >= 2);
    if (allSteps.length === 0) return Promise.resolve(null);
    // Sum step values by label
    const byLabel: Record<string, number> = {};
    for (const steps of allSteps) {
      for (const s of steps) {
        byLabel[s.label] = (byLabel[s.label] ?? 0) + s.value;
      }
    }
    const summedSteps = BRIDGE_ORDER.filter(l => byLabel[l] !== undefined).map(label => ({
      label,
      value: byLabel[label],
      kind: (label === 'Plan' || label === 'Actual' ? 'total' : 'delta') as 'total' | 'delta',
    }));
    if (summedSteps.length >= 2) {
      return Promise.resolve({ data: buildRevenueDataFromSteps(summedSteps), source: 'sheet' as DataSource });
    }
    return Promise.resolve(null);
  };

  const tryLoad = (csv: string): Promise<{ data: RevenueData; source: DataSource } | null> => {
    if (viewType === 'monthly') return tryLoadMonthly(csv, month);
    return tryLoadCumulative(csv, viewType);
  };

  // 1) Try export URL with GID first
  try {
    const csv = await fetchSheetCsv(gid);
    const result = await tryLoad(csv);
    if (result) return result;
  } catch (e) {
    console.warn('GID export failed, trying pub URL:', e);
  }

  // 2) Fallback: Publish-to-web URL
  if (pubUrl) {
    try {
      const csv = await fetchSheetCsvByUrl(pubUrl);
      const result = await tryLoad(csv);
      if (result) return result;
    } catch (e) {
      console.warn('Pub URL fetch failed:', e);
    }
  }

  return { data: generateRevenueData(month, clientType, viewType), source: 'mock' };
}

export interface ContributorByClient {
  clientName: string;
  variance: number;
  planValue: number;
  actualValue: number;
}

/**
 * Load all driver breakdown sheets for the given client type and month,
 * then aggregate variance, plan and actual by client name. Used for "Top & bottom contributors"
 * and "Plan vs actual (clients)" scatter.
 */
export async function loadContributorsByClient(
  clientType: ClientType,
  selectedMonth: string
): Promise<ContributorByClient[]> {
  const gids = BREAKDOWN_GIDS[clientType] as Record<string, number>;
  const byClient = new Map<string, { variance: number; planValue: number; actualValue: number }>();

  for (const stepLabel of STEP_LABELS_WITH_BREAKDOWN) {
    const gid = gids[stepLabel];
    if (gid == null) continue;
    try {
      const csv = await fetchSheetCsv(gid);
      const details = stepLabel === 'Fixed fee difference'
        ? parseFixedFeeBreakdownCsv(csv, selectedMonth)
        : parseBreakdownCsv(csv, stepLabel);
      for (const d of details) {
        const name = (d.clientName ?? '').trim() || 'Unknown';
        const v = typeof d.variance === 'number' && Number.isFinite(d.variance) ? d.variance : 0;
        const plan = typeof d.planValue === 'number' && Number.isFinite(d.planValue) ? d.planValue : 0;
        const actual = typeof d.actualValue === 'number' && Number.isFinite(d.actualValue) ? d.actualValue : 0;
        const prev = byClient.get(name) ?? { variance: 0, planValue: 0, actualValue: 0 };
        byClient.set(name, {
          variance: prev.variance + v,
          planValue: prev.planValue + plan,
          actualValue: prev.actualValue + actual,
        });
      }
    } catch (e) {
      console.warn('Failed to load breakdown for', stepLabel, e);
    }
  }

  return Array.from(byClient.entries()).map(([clientName, agg]) => ({
    clientName,
    variance: agg.variance,
    planValue: agg.planValue,
    actualValue: agg.actualValue,
  }));
}
