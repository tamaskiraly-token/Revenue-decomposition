import React from 'react';

export interface ClientDetail {
  clientName: string;
  planValue: number;
  actualValue: number;
  variance: number;
  variancePct: number;
  // Additional fields for different driver types
  planPrice?: number;
  actualPrice?: number;
  planVolume?: number;
  actualVolume?: number;
  planDate?: string;
  actualDate?: string;
  daysDelay?: number;
  churnReason?: string;
  fxRate?: number;
  fxChange?: number;
}

interface DriverDetailModalProps {
  driverName: string;
  driverValue: number;
  clientDetails: ClientDetail[];
  onClose: () => void;
  planFX?: number;
}

export function DriverDetailModal({ driverName, driverValue, clientDetails, onClose, planFX = 1.0 }: DriverDetailModalProps) {
  // Safety check
  if (!clientDetails || !Array.isArray(clientDetails) || clientDetails.length === 0) {
    return null;
  }

  const formatMoney = (x: number, cur = '$') => {
    if (isNaN(x) || !isFinite(x)) return '$0';
    const sign = x < 0 ? '-' : '';
    const v = Math.abs(x);
    if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
    if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
    return `${sign}${cur}${v.toFixed(0)}`;
  };

  const formatPct = (x: number) => {
    if (isNaN(x) || !isFinite(x)) return '0.0%';
    return `${(x * 100).toFixed(1)}%`;
  };

  const formatPrice = (x: number) => {
    if (isNaN(x) || !isFinite(x)) return '$0.0000';
    return `$${x.toFixed(4)}`;
  };

  // Determine what type of data to show based on driver name
  const isVolume = driverName.toLowerCase().includes('volume');
  const isPrice = driverName.toLowerCase().includes('price');
  const isTiming = driverName.toLowerCase().includes('timing');
  const isChurn = driverName.toLowerCase().includes('churn');
  const isFX = driverName.toLowerCase().includes('fx');

  // Filter out invalid details and sort by absolute variance
  const validDetails = clientDetails.filter(d => d && d.clientName && isFinite(d.variance));
  
  if (validDetails.length === 0) {
    return null;
  }
  
  const sortedDetails = [...validDetails].sort((a, b) => Math.abs(b.variance || 0) - Math.abs(a.variance || 0));
  const totalVariance = validDetails.reduce((sum, d) => sum + (d.variance || 0), 0);

  return (
    <div className="sales-modal-backdrop" onClick={onClose}>
      <div className="sales-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '85vh' }}>
        <div className="sales-modal-header">
          <div>
            <div className="sales-modal-title">{driverName} - Detailed Breakdown</div>
            <div className="sales-modal-meta" style={{ marginTop: '6px', fontSize: '12px', color: 'var(--sales-muted)' }}>
              Total contribution: <span style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '700' }}>{formatMoney(driverValue)}</span>
            </div>
          </div>
          <button className="sales-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sales-modal-body">
          <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--sales-text-secondary)', lineHeight: '1.5' }}>
            {isVolume && 'This breakdown shows transaction volume differences per client. Higher volume increases revenue, lower volume decreases it.'}
            {isPrice && 'This breakdown shows price point differences per client. Price increases boost revenue, decreases reduce it.'}
            {isTiming && 'This breakdown shows implementation timing differences. Delays push revenue recognition later, accelerations bring it forward.'}
            {isChurn && 'This breakdown shows which clients churned or downgraded, causing revenue loss.'}
            {isFX && 'This breakdown shows FX rate impact per client. FX rate changes affect revenue when converting from local to reporting currency.'}
            {!isVolume && !isPrice && !isTiming && !isChurn && !isFX && `This breakdown shows how ${driverName.toLowerCase()} variance is distributed across clients.`}
            {' Values are sorted by absolute contribution.'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-modal-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Client</th>
                  {isVolume && (
                    <>
                      <th style={{ width: '18%', textAlign: 'right' }}>Plan Volume</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Actual Volume</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Δ Volume</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Δ %</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Revenue Impact</th>
                    </>
                  )}
                  {isPrice && (
                    <>
                      <th style={{ width: '18%', textAlign: 'right' }}>Plan Price</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Actual Price</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Δ Price</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Δ %</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Revenue Impact</th>
                    </>
                  )}
                  {isTiming && (
                    <>
                      <th style={{ width: '18%', textAlign: 'center' }}>Plan Date</th>
                      <th style={{ width: '18%', textAlign: 'center' }}>Actual Date</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Days Delay</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Impact</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Revenue Impact</th>
                    </>
                  )}
                  {isChurn && (
                    <>
                      <th style={{ width: '25%', textAlign: 'left' }}>Reason</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Lost Revenue</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Impact %</th>
                    </>
                  )}
                  {isFX && (
                    <>
                      <th style={{ width: '18%', textAlign: 'right' }}>Plan FX Rate</th>
                      <th style={{ width: '18%', textAlign: 'right' }}>Actual FX Rate</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>FX Change</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Impact</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Revenue Impact</th>
                    </>
                  )}
                  {!isVolume && !isPrice && !isTiming && !isChurn && !isFX && (
                    <>
                      <th style={{ width: '20%', textAlign: 'right' }}>Plan</th>
                      <th style={{ width: '20%', textAlign: 'right' }}>Actual</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Variance</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Variance %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedDetails.map((detail, idx) => {
                  if (!detail) return null;
                  const cls = (detail.variance || 0) >= 0 ? 'pos' : 'neg';
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: '600', color: 'var(--sales-text)' }}>{detail.clientName || 'Unknown'}</td>
                      {isVolume && detail.planVolume !== undefined && detail.actualVolume !== undefined && (
                        <>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.planVolume.toLocaleString()}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.actualVolume.toLocaleString()}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {(() => {
                              const volumeDelta = (detail.actualVolume || 0) - (detail.planVolume || 0);
                              return (volumeDelta > 0 ? '+' : '') + volumeDelta.toLocaleString();
                            })()}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatPct(detail.variancePct || 0)}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(detail.variance || 0)}
                          </td>
                        </>
                      )}
                      {isPrice && detail.planPrice !== undefined && detail.actualPrice !== undefined && (
                        <>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatPrice(detail.planPrice)}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatPrice(detail.actualPrice)}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {(detail.variance || 0) > 0 ? '+' : ''}{formatPrice(detail.variance || 0)}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatPct(detail.variancePct || 0)}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(detail.variance || 0)}
                          </td>
                        </>
                      )}
                      {isTiming && detail.planDate && detail.actualDate && (
                        <>
                          <td style={{ textAlign: 'center', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.planDate}
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.actualDate}
                          </td>
                          <td className={`num ${detail.daysDelay && detail.daysDelay > 0 ? 'neg' : 'pos'}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: detail.daysDelay && detail.daysDelay > 0 ? '#dc2626' : '#0d9488'
                          }}>
                            {detail.daysDelay && detail.daysDelay > 0 ? '+' : ''}{detail.daysDelay || 0} days
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: 'var(--sales-text-secondary)' }}>
                            {detail.daysDelay && detail.daysDelay > 0 ? 'Delayed' : detail.daysDelay && detail.daysDelay < 0 ? 'Accelerated' : 'On time'}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(detail.variance || 0)}
                          </td>
                        </>
                      )}
                      {isChurn && detail.churnReason && (
                        <>
                          <td style={{ color: 'var(--sales-text-secondary)', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.churnReason}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: '#dc2626'
                          }}>
                            {formatMoney(Math.abs(detail.variance || 0))}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            color: '#dc2626'
                          }}>
                            {formatPct(Math.abs(detail.variancePct || 0))}
                          </td>
                        </>
                      )}
                      {isFX && detail.fxRate !== undefined && detail.fxChange !== undefined && (
                        <>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {planFX.toFixed(4)}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.fxRate.toFixed(4)}
                          </td>
                          <td className={`num ${(detail.fxChange || 0) >= 0 ? 'pos' : 'neg'}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: (detail.fxChange || 0) >= 0 ? '#0d9488' : '#dc2626'
                          }}>
                            {(detail.fxChange || 0) > 0 ? '+' : ''}{(detail.fxChange || 0).toFixed(4)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: 'var(--sales-text-secondary)' }}>
                            {(detail.fxChange || 0) >= 0 ? 'Appreciation' : 'Depreciation'}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(detail.variance || 0)}
                          </td>
                        </>
                      )}
                      {!isVolume && !isPrice && !isTiming && !isChurn && !isFX && (
                        <>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatMoney(detail.planValue || 0)}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatMoney(detail.actualValue || 0)}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(detail.variance || 0)}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatPct(detail.variancePct || 0)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--sales-border)', fontWeight: '700' }}>
                  <td style={{ fontWeight: '700', color: 'var(--sales-text)' }}>Total</td>
                  {isVolume && (
                    <>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {validDetails.reduce((sum, d) => sum + (d.planVolume || 0), 0).toLocaleString()}
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {validDetails.reduce((sum, d) => sum + (d.actualVolume || 0), 0).toLocaleString()}
                      </td>
                      <td className={`num ${(() => {
                        const totalVolumeDelta = validDetails.reduce((sum, d) => sum + ((d.actualVolume || 0) - (d.planVolume || 0)), 0);
                        return totalVolumeDelta >= 0 ? 'pos' : 'neg';
                      })()}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: (() => {
                          const totalVolumeDelta = validDetails.reduce((sum, d) => sum + ((d.actualVolume || 0) - (d.planVolume || 0)), 0);
                          return totalVolumeDelta >= 0 ? '#0d9488' : '#dc2626';
                        })()
                      }}>
                        {(() => {
                          const totalVolumeDelta = validDetails.reduce((sum, d) => sum + ((d.actualVolume || 0) - (d.planVolume || 0)), 0);
                          return (totalVolumeDelta > 0 ? '+' : '') + totalVolumeDelta.toLocaleString();
                        })()}
                      </td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatPct(validDetails.reduce((sum, d) => {
                          const volumeDelta = (d.actualVolume || 0) - (d.planVolume || 0);
                          const planVol = d.planVolume || 1;
                          return sum + (planVol !== 0 ? volumeDelta / planVol : 0);
                        }, 0) / validDetails.length * 100)}
                      </td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        fontWeight: '700',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatMoney(totalVariance)}
                      </td>
                    </>
                  )}
                  {isPrice && (
                    <>
                      <td colSpan={3}></td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatMoney(totalVariance)}
                      </td>
                    </>
                  )}
                  {isTiming && (
                    <>
                      <td colSpan={3}></td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatMoney(totalVariance)}
                      </td>
                    </>
                  )}
                  {isChurn && (
                    <>
                      <td></td>
                      <td className={`num`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        fontWeight: '700',
                        color: '#dc2626'
                      }}>
                        {formatMoney(Math.abs(totalVariance))}
                      </td>
                      <td></td>
                    </>
                  )}
                  {isFX && (
                    <>
                      <td colSpan={3}></td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatMoney(totalVariance)}
                      </td>
                    </>
                  )}
                  {!isVolume && !isPrice && !isTiming && !isChurn && !isFX && (
                    <>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {formatMoney(validDetails.reduce((sum, d) => sum + (d.planValue || 0), 0))}
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {formatMoney(validDetails.reduce((sum, d) => sum + (d.actualValue || 0), 0))}
                      </td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatMoney(totalVariance)}
                      </td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatPct(totalVariance / (validDetails.reduce((sum, d) => sum + (d.planValue || 0), 0) || 1))}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
