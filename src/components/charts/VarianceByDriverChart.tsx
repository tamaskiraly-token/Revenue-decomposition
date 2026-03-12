import { useMemo } from 'react';

interface Driver {
  name: string;
  value: number;
}

interface VarianceByDriverChartProps {
  drivers: Driver[];
}

function formatMoney(x: number, cur = '$') {
  const sign = x < 0 ? '-' : '';
  const v = Math.abs(x);
  if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
  if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
  return `${sign}${cur}${v.toFixed(0)}`;
}

export function VarianceByDriverChart({ drivers }: VarianceByDriverChartProps) {
  const { sorted, totalAbs } = useMemo(() => {
    const withAbs = drivers.filter(d => d.value !== 0).map(d => ({ ...d, abs: Math.abs(d.value) }));
    const total = withAbs.reduce((s, d) => s + d.abs, 0) || 1;
    const sorted = [...withAbs].sort((a, b) => b.abs - a.abs);
    return { sorted, totalAbs: total };
  }, [drivers]);

  if (sorted.length === 0) {
    return (
      <div className="sales-chart-card">
        <div className="sales-chart-header">
          <div className="sales-chart-title">Variance by driver</div>
          <div className="sales-chart-sub">Share of total variance (absolute)</div>
        </div>
        <div className="sales-chart-body" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sales-muted)' }}>
          No driver data
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...sorted.map(d => d.abs));

  return (
    <div className="sales-chart-card">
      <div className="sales-chart-header">
        <div className="sales-chart-title">Variance by driver</div>
        <div className="sales-chart-sub">Share of total variance (absolute) — what moved the needle</div>
      </div>
      <div className="sales-chart-body" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sorted.map((d) => {
            const pct = (d.abs / totalAbs) * 100;
            const widthPct = maxVal > 0 ? (d.abs / maxVal) * 100 : 0;
            const isPos = d.value >= 0;
            return (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ width: '140px', fontSize: '12px', color: 'var(--sales-text-secondary)', flexShrink: 0 }} title={d.name}>
                  {d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name}
                </span>
                <div style={{ flex: 1, minWidth: 80, height: 24, background: 'rgba(0,0,0,0.06)', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                  <div
                    style={{
                      width: `${widthPct}%`,
                      minWidth: d.abs > 0 ? 4 : 0,
                      height: '100%',
                      background: isPos ? '#0d9488' : '#dc2626',
                      borderRadius: 6,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ width: 56, textAlign: 'right', fontSize: '12px', fontWeight: 600, color: isPos ? '#0d9488' : '#dc2626' }}>
                  {formatMoney(d.value)}
                </span>
                <span style={{ width: 44, textAlign: 'right', fontSize: '11px', color: 'var(--sales-muted)' }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
