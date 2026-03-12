import { useMemo } from 'react';

export interface ClientDetailForChart {
  clientName: string;
  variance: number;
}

interface TopBottomContributorsChartProps {
  /** Flattened client details from drivers (or aggregated from all driver breakdowns). */
  clientDetails: ClientDetailForChart[];
  /** True while loading breakdowns from sheet. */
  loading?: boolean;
}

function formatMoney(x: number, cur = '$') {
  const sign = x < 0 ? '-' : '';
  const v = Math.abs(x);
  if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
  if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
  return `${sign}${cur}${v.toFixed(0)}`;
}

export function TopBottomContributorsChart({ clientDetails, loading = false }: TopBottomContributorsChartProps) {
  const { topPos, topNeg } = useMemo(() => {
    const byClient = new Map<string, number>();
    for (const c of clientDetails) {
      const name = (c.clientName || '').trim() || 'Unknown';
      byClient.set(name, (byClient.get(name) ?? 0) + c.variance);
    }
    const entries = Array.from(byClient.entries()).map(([clientName, variance]) => ({ clientName, variance }));
    const positive = entries.filter(e => e.variance > 0).sort((a, b) => b.variance - a.variance).slice(0, 5);
    const negative = entries.filter(e => e.variance < 0).sort((a, b) => a.variance - b.variance).slice(0, 5);
    return { topPos: positive, topNeg: negative };
  }, [clientDetails]);

  const hasData = topPos.length > 0 || topNeg.length > 0;
  const maxAbs = Math.max(
    ...topPos.map(c => c.variance),
    ...topNeg.map(c => Math.abs(c.variance)),
    1
  );

  return (
    <div className="sales-chart-card">
      <div className="sales-chart-header">
        <div className="sales-chart-title">Top & bottom contributors</div>
        <div className="sales-chart-sub">Clients with largest positive and negative revenue impact</div>
      </div>
      <div className="sales-chart-body" style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sales-muted)', fontSize: '13px' }}>
            Loading…
          </div>
        ) : !hasData ? (
          <div style={{ minHeight: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sales-muted)', fontSize: '13px' }}>
            No client-level data
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0d9488', marginBottom: '10px' }}>Top 5 positive</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topPos.map(c => (
                  <div key={c.clientName} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'var(--sales-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.clientName}>
                      {c.clientName}
                    </div>
                    <div style={{ width: '60%', maxWidth: 120, height: 18, background: 'rgba(13,148,136,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(c.variance / maxAbs) * 100}%`, height: '100%', background: '#0d9488', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0d9488', flexShrink: 0 }}>{formatMoney(c.variance)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '10px' }}>Top 5 negative</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topNeg.map(c => (
                  <div key={c.clientName} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'var(--sales-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.clientName}>
                      {c.clientName}
                    </div>
                    <div style={{ width: '60%', maxWidth: 120, height: 18, background: 'rgba(220,38,38,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(Math.abs(c.variance) / maxAbs) * 100}%`, height: '100%', background: '#dc2626', borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', flexShrink: 0 }}>{formatMoney(c.variance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
