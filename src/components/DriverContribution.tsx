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

  const other = drivers.find((d) => d.name.includes('Other') || d.name.includes('residual'));
  const absOther = other ? Math.abs(other.value) : 0;
  const absVar = Math.abs(variance);
  const otherShare = absVar > 0 ? absOther / absVar : 0;

  return (
    <div className="sales-chart-card">
      <div className="sales-chart-header">
        <div className="sales-chart-title">Driver Contribution (Ranked)</div>
        <div className="sales-chart-sub">
          Contribution to variance in reporting currency
          {viewType !== 'monthly' && ` • ${viewType.replace('-', ' ')} view`}
        </div>
      </div>
      <div className="sales-chart-body">
        <div style={{ overflowX: 'auto' }}>
          <table className="sales-modal-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '34%' }}>Driver</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Contribution</th>
                <th style={{ width: '16%', textAlign: 'right' }}>Share (abs)</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
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
                    <td className={`num ${cls}`} style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: cls === 'pos' ? '#0d9488' : '#dc2626' }}>
                      {formatMoney(d.value)}
                    </td>
                    <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                      {(share * 100).toFixed(1)}%
                    </td>
                    <td style={{ color: 'var(--sales-text-secondary)' }}>{d.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {other && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--sales-muted)', lineHeight: '1.35' }}>
            Sanity check: "Other / residual" is <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '600' }}>{formatMoney(other.value)}</span> ({otherShare.toFixed(1)}% of total variance). Ideally this stays small over time.
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
