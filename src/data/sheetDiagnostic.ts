/**
 * Diagnostic: test Google Sheet reachability and parsing. Used by the UI to show why data might not load.
 */

import { SPREADSHEET_ID, WATERFALL_GIDS, PUB_WATERFALL_URLS } from '../config/sheets';
import type { ClientType } from '../config/sheets';
import { parseWaterfallCsv } from './googleSheets';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export interface FetchDiagnostic {
  url: string;
  ok: boolean;
  statusCode?: number;
  error?: string;
  csvLength?: number;
  csvPreview?: string;
  stepsCount?: number;
  stepsPreview?: Array<{ label: string; value: number }>;
}

export interface SheetDiagnostic {
  month: string;
  clientType: ClientType;
  pubUrl?: FetchDiagnostic;
  gidUrl?: FetchDiagnostic;
  usedSource: 'sheet' | 'mock' | 'none';
}

async function tryFetchDiagnostic(url: string, month: string): Promise<FetchDiagnostic> {
  const out: FetchDiagnostic = { url: url.length > 60 ? url.slice(0, 60) + '...' : url, ok: false };
  try {
    const res = await fetch(url, { mode: 'cors' });
    out.statusCode = res.status;
    if (!res.ok) {
      out.error = `HTTP ${res.status}`;
      return out;
    }
    let text = await res.text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    out.ok = true;
    out.csvLength = text.length;
    out.csvPreview = text.slice(0, 350).replace(/\n/g, ' ↵ ');
    const steps = parseWaterfallCsv(text, month);
    out.stepsCount = steps.length;
    out.stepsPreview = steps.slice(0, 12).map(s => ({ label: s.label, value: s.value }));
    return out;
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    try {
      const proxyUrl = CORS_PROXY + encodeURIComponent(url);
      const res2 = await fetch(proxyUrl);
      out.statusCode = res2.status;
      if (!res2.ok) {
        out.error = `Proxy HTTP ${res2.status}`;
        return out;
      }
      let text = await res2.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      out.ok = true;
      out.csvLength = text.length;
      out.csvPreview = text.slice(0, 350).replace(/\n/g, ' ↵ ');
      const steps = parseWaterfallCsv(text, month);
      out.stepsCount = steps.length;
      out.stepsPreview = steps.slice(0, 12).map(s => ({ label: s.label, value: s.value }));
      return out;
    } catch (e2) {
      out.error = (out.error ? out.error + '; proxy: ' : '') + (e2 instanceof Error ? e2.message : String(e2));
      return out;
    }
  }
}

/**
 * Run diagnostic: try both pub URL and GID export, return fetch + parse results for the UI.
 */
export async function runSheetDiagnostic(
  month: string,
  clientType: ClientType
): Promise<SheetDiagnostic> {
  const pubUrl = PUB_WATERFALL_URLS[clientType];
  const gid = WATERFALL_GIDS[clientType];
  const gidFullUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  const result: SheetDiagnostic = {
    month,
    clientType,
    usedSource: 'none',
  };

  if (pubUrl) {
    result.pubUrl = await tryFetchDiagnostic(pubUrl, month);
    if (result.pubUrl.ok && (result.pubUrl.stepsCount ?? 0) >= 2) result.usedSource = 'sheet';
  }

  if (result.usedSource !== 'sheet') {
    result.gidUrl = await tryFetchDiagnostic(gidFullUrl, month);
    if (result.gidUrl.ok && (result.gidUrl.stepsCount ?? 0) >= 2) result.usedSource = 'sheet';
  }

  if (result.usedSource !== 'sheet') result.usedSource = 'mock';
  return result;
}
