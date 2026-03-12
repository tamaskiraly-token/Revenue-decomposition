import { useMemo, useState } from 'react';
import type { ViewType } from './VarianceBridge';
import { DriverDetailModal, type ClientDetail } from './DriverDetailModal';

interface Driver {
  name: string;
  value: number;
  note: string;
  clientDetails?: ClientDetail[];
}

interface DriverContributionProps {
  drivers: Driver[];
  variance: number;
  viewType?: ViewType;
}

export function DriverContribution({ drivers, variance, viewType = 'monthly' }: DriverContributionProps) {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const formatMoney = (x: number, cur = '$') => {
    const sign = x < 0 ? '-' : '';
    const v = Math.abs(x);
    if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
    if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
    return `${sign}${cur}${v.toFixed(0)}`;
  };

  // Transform drivers based on viewType
  const transformedDrivers = useMemo(() => {
    if (viewType === 'monthly') {
      return drivers;
    }
    // For quarterly/annual cumulative, we would aggregate data here
    // For now, return drivers as-is (can be enhanced with actual aggregation logic)
    return drivers;
  }, [drivers, viewType]);

  // Rank by absolute contribution
  const ranked = [...transformedDrivers].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const totalAbs = ranked.reduce((s, d) => s + Math.abs(d.value), 0) || 1;

  const residual = drivers.find((d) => d.name.includes('Residual') || d.name.includes('residual'));
  const absResidual = residual ? Math.abs(residual.value) : 0;
  const absVar = Math.abs(variance);
  const residualShare = absVar > 0 ? absResidual / absVar : 0;

  return (
    <div className="sales-chart-card sales-driver-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="sales-chart-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(30, 27, 75, 0.1)', flexShrink: 0 }}>
        <div className="sales-chart-title" style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginBottom: '4px', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
          Driver Contribution (Ranked)
        </div>
        <div className="sales-chart-sub" style={{ fontSize: '12px', color: 'rgba(51, 65, 85, 0.75)', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
          Contribution to variance in reporting currency
          {viewType !== 'monthly' && ` • ${viewType.replace('-', ' ')} view`}
        </div>
      </div>
      <div className="sales-chart-body" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ overflowX: 'auto', overflowY: 'visible', minWidth: 0 }}>
          <table className="sales-modal-table sales-driver-table" style={{ width: '100%', minWidth: '260px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '1%', minWidth: 80 }}>Driver</th>
                <th style={{ width: '100px', textAlign: 'right', whiteSpace: 'nowrap' }}>Contribution</th>
                <th style={{ width: '72px', textAlign: 'right', whiteSpace: 'nowrap' }}>Share (abs)</th>
              </tr>
            </thead>
            <tbody key={ranked.map((d) => `${d.name}:${d.value}`).join('|')}>
              {ranked.map((d) => {
                const cls = d.value >= 0 ? 'pos' : 'neg';
                const share = Math.abs(d.value) / totalAbs;
                const hasDetails = d.clientDetails && d.clientDetails.length > 0;
                return (
                  <tr 
                    key={d.name}
                    onClick={() => hasDetails && setSelectedDriver(d)}
                    style={{ 
                      cursor: hasDetails ? 'pointer' : 'default',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (hasDetails) {
                        e.currentTarget.style.background = 'rgba(30, 27, 75, 0.04)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                    }}
                  >
                    <td>
                      <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 10px', borderRadius: '999px', border: '1px solid var(--sales-border)', background: 'rgba(0,0,0,0.05)', fontSize: '12px' }}>
                        {d.name}
                        {hasDetails && <span style={{ fontSize: '10px', opacity: 0.6 }}>👆</span>}
                      </span>
                    </td>
                    <td className={`num ${cls}`} style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: cls === 'pos' ? '#0d9488' : '#dc2626', whiteSpace: 'nowrap' }}>
                      {formatMoney(d.value)}
                    </td>
                    <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                      {(share * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {residual && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--sales-muted)', lineHeight: '1.35' }}>
            Sanity check: Residual is <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '600' }}>{formatMoney(residual.value)}</span> ({residualShare.toFixed(1)}% of total variance). Ideally this stays small over time.
          </div>
        )}
      </div>
      {selectedDriver && selectedDriver.clientDetails && Array.isArray(selectedDriver.clientDetails) && selectedDriver.clientDetails.length > 0 && (
        <DriverDetailModal
          driverName={selectedDriver.name}
          driverValue={selectedDriver.value}
          clientDetails={selectedDriver.clientDetails}
          onClose={() => setSelectedDriver(null)}
        />
      )}
    </div>
  );
}
