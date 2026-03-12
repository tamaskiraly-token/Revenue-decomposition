import { useState, useEffect, useMemo } from 'react';
import { Sidebar, type SalesTabId } from './components/Sidebar';
import { PerformanceCards } from './components/PerformanceCards';
import { VarianceBridge, type ViewType } from './components/VarianceBridge';
import { DriverContribution } from './components/DriverContribution';
import { SummaryInsights } from './components/SummaryInsights';
import { FPAChartsSection } from './components/FPAChartsSection';
import { loadRevenueData } from './data/revenueDataService';
import { runSheetDiagnostic, type SheetDiagnostic } from './data/sheetDiagnostic';
import { generateRevenueData } from './data/mockData';
import type { RevenueData } from './data/mockData';
import type { ClientType } from './config/sheets';

/** Data available only up to February; default to latest (Feb). */
const LATEST_MONTH = '2026-02';
const MONTHS_FOR_TREND = ['2026-01', '2026-02'];
const MONTH_LABELS: Record<string, string> = { '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec' };

function App() {
  const [activeTab, setActiveTab] = useState<SalesTabId>('existing-clients');
  const [selectedMonth, setSelectedMonth] = useState(LATEST_MONTH);
  const [viewType, setViewType] = useState<ViewType>('monthly');
  const [revenueData, setRevenueData] = useState<RevenueData>(() =>
    generateRevenueData(LATEST_MONTH, 'existing-clients', 'monthly')
  );
  const [dataSource, setDataSource] = useState<'sheet' | 'mock'>('mock');
  const [diagnostic, setDiagnostic] = useState<SheetDiagnostic | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [varianceTrendData, setVarianceTrendData] = useState<Array<{ monthKey: string; variance: number }>>([]);
  const [revenueMixData, setRevenueMixData] = useState<{ existing: RevenueData | null; newClients: RevenueData | null }>({ existing: null, newClients: null });

  useEffect(() => {
    let cancelled = false;
    loadRevenueData(selectedMonth, activeTab as ClientType, viewType).then(({ data, source }) => {
      if (!cancelled) {
        setRevenueData(data);
        setDataSource(source);
      }
    });
    return () => { cancelled = true; };
  }, [selectedMonth, activeTab, viewType]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(MONTHS_FOR_TREND.map(monthKey => loadRevenueData(monthKey, 'existing-clients', 'monthly'))).then(results => {
      if (cancelled) return;
      setVarianceTrendData(MONTHS_FOR_TREND.map((monthKey, i) => ({
        monthKey,
        variance: results[i]?.data.variance ?? 0,
      })));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadRevenueData(selectedMonth, 'existing-clients', 'monthly'),
      loadRevenueData(selectedMonth, 'new-clients', 'monthly'),
    ]).then(([existingRes, newRes]) => {
      if (cancelled) return;
      setRevenueMixData({
        existing: existingRes?.data ?? null,
        newClients: newRes?.data ?? null,
      });
    });
    return () => { cancelled = true; };
  }, [selectedMonth]);

  const varianceTrendPoints = useMemo(() =>
    varianceTrendData.map(({ monthKey, variance }) => {
      const [, mm] = monthKey.split('-');
      return { monthKey, label: MONTH_LABELS[mm] ?? monthKey, variance };
    }),
    [varianceTrendData]
  );

  const revenueMix = useMemo(() => ({
    existing: revenueMixData.existing ? { planRec: revenueMixData.existing.planRec, actual: revenueMixData.existing.actual } : null,
    newClients: revenueMixData.newClients ? { planRec: revenueMixData.newClients.planRec, actual: revenueMixData.newClients.actual } : null,
  }), [revenueMixData]);

  return (
    <div className="sales-app">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />
      <main className="sales-main">
        <div className="sales-main-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
        <div className="sales-page-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: '1', minWidth: '0' }}>
              <h1 className="sales-page-title">
                Revenue Decomposition (Plan → Actual) — Monthly FP&A Bridge
              </h1>
              <p className="sales-page-subtitle">
                Variance bridge decomposes recognized revenue into <span style={{ fontWeight: '600' }}>Fixed fee difference</span>, <span style={{ fontWeight: '600' }}>Volume</span>, <span style={{ fontWeight: '600' }}>Price</span>, <span style={{ fontWeight: '600' }}>Timing</span>, <span style={{ fontWeight: '600' }}>FX</span>, and <span style={{ fontWeight: '600' }}>Residual</span>.
                {dataSource === 'sheet' ? (
                  <span style={{ color: 'var(--sales-primary)', fontWeight: '600' }}> Data from Google Sheet.</span>
                ) : (
                  <span style={{ color: 'var(--sales-muted)' }}> Sample data (Google Sheet could not be loaded).</span>
                )}
              </p>
              {dataSource === 'mock' && viewType === 'monthly' && (
                <p style={{ fontSize: '12px', color: '#b45309', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span aria-hidden>⚠</span>
                  Data is loaded from the Google Sheet. If you see sample data, ensure the sheet is shared as &quot;Anyone with the link can view&quot;, or try again later.
                </p>
              )}
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setDiagnosticLoading(true);
                    setDiagnosticOpen(true);
                    runSheetDiagnostic(selectedMonth, activeTab as ClientType).then((d) => {
                      setDiagnostic(d);
                      setDiagnosticLoading(false);
                    });
                  }}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--sales-border)',
                    background: 'var(--sales-surface)',
                    color: 'var(--sales-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  🔍 Test Sheet connection
                </button>
                {diagnosticOpen && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--sales-border)', fontSize: '12px', maxWidth: '720px' }}>
                    {diagnosticLoading ? (
                      <span>Running test…</span>
                    ) : diagnostic ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <strong>Diagnostic</strong>
                          <button type="button" onClick={() => setDiagnosticOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                        </div>
                        <p style={{ margin: '0 0 8px', color: 'var(--sales-text-secondary)' }}>
                          Month: {diagnostic.month} | Tab: {diagnostic.clientType} | Result: {diagnostic.usedSource === 'sheet' ? '✅ Sheet data' : '❌ Sample data (sheet not available)'}
                        </p>
                        {diagnostic.pubUrl && (
                          <div style={{ marginBottom: '12px' }}>
                            <strong>1) Publish-to-web URL:</strong>
                            {diagnostic.pubUrl.ok ? (
                              <p style={{ margin: '4px 0', color: '#0d9488' }}>
                                ✅ OK – CSV length: {diagnostic.pubUrl.csvLength} chars, steps found: {diagnostic.pubUrl.stepsCount ?? 0}
                                {diagnostic.pubUrl.stepsPreview && diagnostic.pubUrl.stepsPreview.length > 0 && (
                                  <span style={{ display: 'block', marginTop: '4px' }}>
                                    Example: {diagnostic.pubUrl.stepsPreview.map(s => `${s.label}=${s.value}`).join(', ')}
                                  </span>
                                )}
                              </p>
                            ) : (
                              <p style={{ margin: '4px 0', color: '#dc2626' }}>❌ {diagnostic.pubUrl.error}</p>
                            )}
                            {diagnostic.pubUrl.csvPreview && (
                              <pre style={{ margin: '4px 0', padding: '6px', background: '#fff', borderRadius: '4px', overflow: 'auto', maxHeight: '80px', fontSize: '11px' }}>{diagnostic.pubUrl.csvPreview}</pre>
                            )}
                          </div>
                        )}
                        {diagnostic.gidUrl && (
                          <div>
                            <strong>2) Export URL (GID + proxy):</strong>
                            {diagnostic.gidUrl.ok ? (
                              <p style={{ margin: '4px 0', color: '#0d9488' }}>
                                ✅ OK – CSV length: {diagnostic.gidUrl.csvLength} chars, steps found: {diagnostic.gidUrl.stepsCount ?? 0}
                                {diagnostic.gidUrl.stepsPreview && diagnostic.gidUrl.stepsPreview.length > 0 && (
                                  <span style={{ display: 'block', marginTop: '4px' }}>
                                    Example: {diagnostic.gidUrl.stepsPreview.map(s => `${s.label}=${s.value}`).join(', ')}
                                  </span>
                                )}
                              </p>
                            ) : (
                              <p style={{ margin: '4px 0', color: '#dc2626' }}>❌ {diagnostic.gidUrl.error}</p>
                            )}
                            {diagnostic.gidUrl.csvPreview && (
                              <pre style={{ margin: '4px 0', padding: '6px', background: '#fff', borderRadius: '4px', overflow: 'auto', maxHeight: '80px', fontSize: '11px' }}>{diagnostic.gidUrl.csvPreview}</pre>
                            )}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--sales-text-secondary)', marginRight: '4px', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>View:</span>
              <button
                type="button"
                onClick={() => setViewType('monthly')}
                className={`sales-view-switch-btn ${viewType === 'monthly' ? 'active' : ''}`}
                style={{
                  padding: '8px 14px',
                  minHeight: '36px',
                  borderRadius: '12px',
                  border: '1px solid var(--sales-border)',
                  background: viewType === 'monthly' ? 'var(--sales-primary)' : 'var(--sales-surface)',
                  color: viewType === 'monthly' ? '#fff' : 'var(--sales-text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setViewType('quarterly-cumulative')}
                className={`sales-view-switch-btn ${viewType === 'quarterly-cumulative' ? 'active' : ''}`}
                style={{
                  padding: '8px 14px',
                  minHeight: '36px',
                  borderRadius: '12px',
                  border: '1px solid var(--sales-border)',
                  background: viewType === 'quarterly-cumulative' ? 'var(--sales-primary)' : 'var(--sales-surface)',
                  color: viewType === 'quarterly-cumulative' ? '#fff' : 'var(--sales-text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                }}
              >
                Quarterly cumulative
              </button>
              <button
                type="button"
                onClick={() => setViewType('annual-cumulative')}
                className={`sales-view-switch-btn ${viewType === 'annual-cumulative' ? 'active' : ''}`}
                style={{
                  padding: '8px 14px',
                  minHeight: '36px',
                  borderRadius: '12px',
                  border: '1px solid var(--sales-border)',
                  background: viewType === 'annual-cumulative' ? 'var(--sales-primary)' : 'var(--sales-surface)',
                  color: viewType === 'annual-cumulative' ? '#fff' : 'var(--sales-text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                }}
              >
                Annual cumulative
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px', flexShrink: 0 }}>
          <PerformanceCards
            planRec={revenueData.planRec}
            actual={revenueData.actual}
            variance={revenueData.variance}
            varPct={revenueData.varPct}
          />
        </div>

        <div className="sales-waterfall-driver-row" style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)', gap: '24px', alignItems: 'stretch', minHeight: '380px', flexShrink: 0 }}>
          <div style={{ minWidth: 0, display: 'flex', overflow: 'hidden' }}>
            <VarianceBridge
              key={activeTab}
              steps={revenueData.bridgeSteps}
              viewType={viewType}
              clientType={activeTab as ClientType}
              selectedMonth={selectedMonth}
            />
          </div>
          <div style={{ minWidth: 0, display: 'flex', overflow: 'hidden' }}>
            <DriverContribution drivers={revenueData.drivers} variance={revenueData.variance} viewType={viewType} />
          </div>
        </div>

        <div style={{ marginBottom: '20px', flexShrink: 0 }}>
          <SummaryInsights insights={revenueData.insights} viewType={viewType} />
        </div>

        <FPAChartsSection
          revenueData={revenueData}
          varianceTrendPoints={varianceTrendPoints}
          revenueMix={revenueMix}
          clientType={activeTab as ClientType}
          selectedMonth={selectedMonth}
        />
        </div>
      </main>
    </div>
  );
}

export default App;
