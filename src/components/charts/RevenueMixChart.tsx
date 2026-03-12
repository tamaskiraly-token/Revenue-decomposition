import { useMemo } from 'react';

export interface RevenueMixSegment {
  planRec: number;
  actual: number;
}

interface RevenueMixChartProps {
  existing: RevenueMixSegment | null;
  newClients: RevenueMixSegment | null;
}

function formatMoney(x: number, cur = '$') {
  const sign = x < 0 ? '-' : '';
  const v = Math.abs(x);
  if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
  if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
  return `${sign}${cur}${v.toFixed(0)}`;
}

export function RevenueMixChart({ existing, newClients }: RevenueMixChartProps) {
  const { planTotal, actualTotal, planExistingPct, planNewPct, actualExistingPct, actualNewPct } = useMemo(() => {
    const ex = existing ?? { planRec: 0, actual: 0 };
    const nu = newClients ?? { planRec: 0, actual: 0 };
    const planTotal = ex.planRec + nu.planRec;
    const actualTotal = ex.actual + nu.actual;
    const planExistingPct = planTotal > 0 ? ex.planRec / planTotal : 0;
    const planNewPct = planTotal > 0 ? nu.planRec / planTotal : 0;
    const actualExistingPct = actualTotal > 0 ? ex.actual / actualTotal : 0;
    const actualNewPct = actualTotal > 0 ? nu.actual / actualTotal : 0;
    return { planTotal, actualTotal, planExistingPct, planNewPct, actualExistingPct, actualNewPct, ex, nu };
  }, [existing, newClients]);

  const barW = 24;
  const maxW = 200;

  const hasData = (existing && (existing.planRec > 0 || existing.actual > 0)) || (newClients && (newClients.planRec > 0 || newClients.actual > 0));

  return (
    <div className="sales-chart-card">
      <div className="sales-chart-header">
        <div className="sales-chart-title">Revenue mix: Existing vs new</div>
        <div className="sales-chart-sub">Where revenue comes from — Plan vs Actual</div>
      </div>
      <div className="sales-chart-body" style={{ padding: '20px 24px' }}>
        {!hasData ? (
          <div style={{ minHeight: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sales-muted)', fontSize: '13px' }}>
            No revenue mix data
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ width: 56, fontSize: '12px', fontWeight: 600, color: 'var(--sales-text-secondary)' }}>Plan</span>
              <div style={{ display: 'flex', width: maxW + 8, height: barW, background: 'rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${planExistingPct * 100}%`, height: '100%', background: '#1e1b4b', borderRadius: 0 }} title="Existing" />
                <div style={{ width: `${planNewPct * 100}%`, height: '100%', background: '#0ea5e9', borderRadius: 0 }} title="New" />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sales-text)' }}>{formatMoney(planTotal)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ width: 56, fontSize: '12px', fontWeight: 600, color: 'var(--sales-text-secondary)' }}>Actual</span>
              <div style={{ display: 'flex', width: maxW + 8, height: barW, background: 'rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${actualExistingPct * 100}%`, height: '100%', background: '#1e1b4b', borderRadius: 0 }} title="Existing" />
                <div style={{ width: `${actualNewPct * 100}%`, height: '100%', background: '#0ea5e9', borderRadius: 0 }} title="New" />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sales-text)' }}>{formatMoney(actualTotal)}</span>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '11px', color: 'var(--sales-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#1e1b4b' }} /> Existing</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#0ea5e9' }} /> New</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
