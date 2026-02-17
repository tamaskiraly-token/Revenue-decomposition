import { useState, useMemo } from 'react';
import { Sidebar, type SalesTabId } from './components/Sidebar';
import { PerformanceCards } from './components/PerformanceCards';
import { VarianceBridge, type ViewType } from './components/VarianceBridge';
import { DriverContribution } from './components/DriverContribution';
import { SummaryInsights } from './components/SummaryInsights';
import { generateRevenueData } from './data/mockData';

function App() {
  const [activeTab, setActiveTab] = useState<SalesTabId>('existing-clients');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [viewType, setViewType] = useState<ViewType>('monthly');

  const revenueData = useMemo(() => generateRevenueData(selectedMonth, activeTab, viewType), [selectedMonth, activeTab, viewType]);

  return (
    <div className="sales-app">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />
      <main className="sales-main">
        <div className="sales-page-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ flex: '1', minWidth: '0' }}>
              <h1 className="sales-page-title">
                Revenue Decomposition (Plan → Actual) — Monthly FP&A Bridge
              </h1>
              <p className="sales-page-subtitle">
                Variance bridge decomposes recognized revenue into <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '600' }}>Volume</span>, <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '600' }}>Price</span>, <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '600' }}>Timing (implementation)</span>, <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '600' }}>FX</span>, and <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '600' }}>Other</span>.
                Data below is randomly generated but internally consistent.
              </p>
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

        <div style={{ marginBottom: '28px' }}>
          <PerformanceCards
            planRec={revenueData.planRec}
            actual={revenueData.actual}
            variance={revenueData.variance}
            varPct={revenueData.varPct}
            planDelay={revenueData.planDelay}
            actualDelay={revenueData.actualDelay}
            planFX={revenueData.planFX}
            actualFX={revenueData.actualFX}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <VarianceBridge 
            steps={revenueData.bridgeSteps} 
            viewType={viewType}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <DriverContribution drivers={revenueData.drivers} variance={revenueData.variance} viewType={viewType} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <SummaryInsights insights={revenueData.insights} viewType={viewType} />
        </div>
      </main>
    </div>
  );
}

export default App;
