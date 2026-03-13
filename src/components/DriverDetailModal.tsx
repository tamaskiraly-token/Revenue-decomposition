import { useState, useMemo } from 'react';

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
  /** FX breakdown: plan FX rate from sheet (FX (Plan) column) */
  planFxRate?: number;
  /** Fixed fee breakdown */
  currency?: string;
  revenueComponent?: string;
  comment?: string;
}

interface DriverDetailModalProps {
  driverName: string;
  driverValue: number;
  clientDetails: ClientDetail[];
  onClose: () => void;
  planFX?: number;
}

export function DriverDetailModal({ driverName, driverValue, clientDetails, onClose, planFX = 1.0 }: DriverDetailModalProps) {
  if (!clientDetails || !Array.isArray(clientDetails)) return null;
  const isEmpty = clientDetails.length === 0;

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
  const isFixedFee = driverName.toLowerCase().includes('fixed fee');
  const isVolume = driverName.toLowerCase().includes('volume');
  const isPrice = driverName.toLowerCase().includes('price');
  const isTiming = driverName.toLowerCase().includes('timing');
  const isChurn = driverName.toLowerCase().includes('churn');
  const isFX = driverName.toLowerCase().includes('fx');
  // New clients timing breakdown is excel-like (Currency / Revenue component / Amounts / FX Plan / TOTAL / Comment)
  const timingExcelLike = isTiming && clientDetails.some(d => !!d.currency || !!d.revenueComponent || d.planFxRate != null || !!d.comment);

  const [totalSortOrder, setTotalSortOrder] = useState<'asc' | 'desc'>('desc');

  // Revenue Impact for sorting: use signed value (Volume/Price: negative when delta is negative)
  const getSortVariance = (d: ClientDetail) => {
    const raw = d.variance ?? 0;
    if (isVolume) {
      const delta = (d.actualVolume ?? d.actualValue ?? 0) - (d.planVolume ?? d.planValue ?? 0);
      return raw > 0 && delta < 0 ? -raw : raw;
    }
    if (isPrice) {
      const delta = (d.actualPrice ?? d.actualValue ?? 0) - (d.planPrice ?? d.planValue ?? 0);
      return raw > 0 && delta < 0 ? -raw : raw;
    }
    return raw;
  };

  // Filter: invalid rows; for Fixed fee only show rows where TOTAL !== 0; for Price only show rows where revenue impact !== 0
  const sortedDetails = useMemo(() => {
    const list = clientDetails.filter(d => {
      if (!d || !d.clientName || !isFinite(d.variance)) return false;
      if (isFixedFee && d.variance === 0) return false;
      if (isPrice && (d.variance ?? 0) === 0) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const va = getSortVariance(a);
      const vb = getSortVariance(b);
      return totalSortOrder === 'desc' ? vb - va : va - vb;
    });
  }, [clientDetails, isFixedFee, isPrice, totalSortOrder]);

  const totalVariance = sortedDetails.reduce((sum, d) => sum + (d.variance || 0), 0);

  return (
    <div className="sales-modal-backdrop" onClick={onClose}>
      <div className="sales-modal sales-modal--large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(95vw, 1200px)', maxHeight: '90vh', width: 'min(95vw, 1200px)' }}>
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
        {!isPrice && !isEmpty && (
          <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--sales-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--sales-text-secondary)' }}>Sort by TOTAL:</span>
            <button
              type="button"
              onClick={() => setTotalSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                border: '1px solid var(--sales-border)',
                borderRadius: 'var(--sales-radius-sm)',
                background: 'var(--sales-surface)',
                color: 'var(--sales-accent)',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {totalSortOrder === 'desc' ? 'Descending ↓' : 'Ascending ↑'}
            </button>
          </div>
        )}
        <div className="sales-modal-body">
          <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--sales-text-secondary)', lineHeight: '1.5' }}>
            {isVolume && 'This breakdown shows transaction volume differences per client. Higher volume increases revenue, lower volume decreases it.'}
            {isPrice && 'This breakdown shows price point differences per client. Price increases boost revenue, decreases reduce it.'}
            {isTiming && 'This breakdown shows implementation timing differences. Delays push revenue recognition later, accelerations bring it forward.'}
            {isChurn && 'This breakdown shows which clients churned or downgraded, causing revenue loss.'}
            {isFX && 'This breakdown shows FX rate impact per client. FX rate changes affect revenue when converting from local to reporting currency.'}
            {isFixedFee && 'This breakdown shows the difference between plan and actual fixed fee component of revenue by client.'}
            {!isVolume && !isPrice && !isTiming && !isChurn && !isFX && !isFixedFee && `This breakdown shows how ${driverName.toLowerCase()} variance is distributed across clients.`}
            {isFixedFee ? ' Only rows with non-zero TOTAL are shown.' : isPrice ? '' : ' Use the button above to sort by TOTAL (Revenue Impact).'}
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(90vh - 220px)' }}>
            {isEmpty ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--sales-muted)', fontSize: '14px' }}>
                No breakdown data available for this driver. The sheet might have a different structure, or there is no data yet.
              </div>
            ) : (
            <table className="sales-modal-table sales-modal-table--compact" style={{ width: '100%' }}>
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
                      {timingExcelLike ? (
                        <>
                          <th style={{ width: '12%', textAlign: 'left' }}>Currency</th>
                          <th style={{ width: '14%', textAlign: 'left' }}>Revenue component</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Amount (Act)</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Amount (Plan)</th>
                          <th style={{ width: '10%', textAlign: 'right' }}>FX Plan</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>TOTAL</th>
                          <th style={{ width: '16%', textAlign: 'left' }}>Comment</th>
                        </>
                      ) : (
                        <>
                          <th style={{ width: '18%', textAlign: 'center' }}>Plan Date</th>
                          <th style={{ width: '18%', textAlign: 'center' }}>Actual Date</th>
                          <th style={{ width: '15%', textAlign: 'right' }}>Days Delay</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Impact</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Revenue Impact</th>
                        </>
                      )}
                    </>
                  )}
                  {isChurn && (
                    <>
                      <th style={{ width: '12%', textAlign: 'left' }}>Currency</th>
                      <th style={{ width: '12%', textAlign: 'left' }}>Revenue component</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Amount (Act)</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>Amount (Plan)</th>
                      <th style={{ width: '12%', textAlign: 'right' }}>TOTAL</th>
                      <th style={{ width: '20%', textAlign: 'left' }}>Comment</th>
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
                  {isFixedFee && (
                    <>
                      <th style={{ width: '12%', textAlign: 'left' }}>Currency</th>
                      <th style={{ width: '12%', textAlign: 'left' }}>Revenue component</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>Amount (Plan)</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>Amount (Act)</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>TOTAL</th>
                      <th style={{ width: '20%', textAlign: 'left' }}>Comment</th>
                    </>
                  )}
                  {!isFixedFee && !isVolume && !isPrice && !isTiming && !isChurn && !isFX && (
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
                  // Volume/Price: derive sign from actual delta so color and Revenue Impact match (sheet may give positive variance when impact is negative)
                  const volumeDelta = isVolume
                    ? (detail.actualVolume ?? detail.actualValue ?? 0) - (detail.planVolume ?? detail.planValue ?? 0)
                    : 0;
                  const planPriceForPct = detail.planPrice ?? detail.planValue ?? 0;
                  const priceDelta = isPrice
                    ? (detail.actualPrice ?? detail.actualValue ?? 0) - planPriceForPct
                    : 0;
                  const rawVariance = detail.variance ?? 0;
                  const impactSignFromDelta = isVolume ? (volumeDelta < 0 ? -1 : 1) : isPrice ? (priceDelta < 0 ? -1 : 1) : null;
                  const displayVariance = impactSignFromDelta != null && rawVariance > 0 && impactSignFromDelta < 0
                    ? -rawVariance
                    : rawVariance;
                  const cls = (impactSignFromDelta != null ? impactSignFromDelta > 0 : rawVariance >= 0) ? 'pos' : 'neg';
                  return (
                    <tr key={idx}>
                      <td className="sales-modal-cell-client" style={{ fontWeight: '600', color: 'var(--sales-text)' }}>{detail.clientName || 'Unknown'}</td>
                      {isVolume && (
                        <>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {(detail.planVolume ?? detail.planValue ?? 0).toLocaleString()}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {(detail.actualVolume ?? detail.actualValue ?? 0).toLocaleString()}
                          </td>
                          <td className={`num ${cls}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {(volumeDelta > 0 ? '+' : '') + volumeDelta.toLocaleString()}
                          </td>
                          <td className={`num ${cls}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatPct(detail.variancePct != null && impactSignFromDelta === -1 ? -Math.abs(detail.variancePct) : (detail.variancePct || 0))}
                          </td>
                          <td className={`num ${cls}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(displayVariance)}
                          </td>
                        </>
                      )}
                      {isPrice && (
                        <>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatPrice(detail.planPrice ?? detail.planValue ?? 0)}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatPrice(detail.actualPrice ?? detail.actualValue ?? 0)}
                          </td>
                          <td className={`num ${cls}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {(priceDelta > 0 ? '+' : '')}{formatPrice(priceDelta)}
                          </td>
                          <td className={`num ${cls}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatPct(planPriceForPct !== 0 ? priceDelta / planPriceForPct : 0)}
                          </td>
                          <td className={`num ${cls}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(displayVariance)}
                          </td>
                        </>
                      )}
                      {isTiming && (
                        <>
                          {timingExcelLike ? (
                            <>
                              <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>{detail.currency ?? '—'}</td>
                              <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>{detail.revenueComponent ?? '—'}</td>
                              <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                                {detail.actualValue != null && isFinite(detail.actualValue) ? formatMoney(detail.actualValue) : '—'}
                              </td>
                              <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                                {detail.planValue != null && isFinite(detail.planValue) ? formatMoney(detail.planValue) : '—'}
                              </td>
                              <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                                {(detail.planFxRate != null ? detail.planFxRate : planFX).toFixed(2)}
                              </td>
                              <td className={`num ${cls}`} style={{ 
                                textAlign: 'right', 
                                fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                                fontWeight: '700',
                                color: cls === 'pos' ? '#0d9488' : '#dc2626'
                              }}>
                                {detail.variance != null && isFinite(detail.variance) ? formatMoney(detail.variance) : '—'}
                              </td>
                              <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: 'var(--sales-text-secondary)' }}>{detail.comment ?? '—'}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ textAlign: 'center', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                                {detail.planDate ?? '—'}
                              </td>
                              <td style={{ textAlign: 'center', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                                {detail.actualDate ?? '—'}
                              </td>
                              <td className={`num ${detail.daysDelay != null && detail.daysDelay > 0 ? 'neg' : 'pos'}`} style={{ 
                                textAlign: 'right', 
                                fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                                fontWeight: '700',
                                color: detail.daysDelay && detail.daysDelay > 0 ? '#dc2626' : '#0d9488'
                              }}>
                                {(detail.daysDelay != null && detail.daysDelay > 0 ? '+' : '')}{(detail.daysDelay ?? 0)} days
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: 'var(--sales-text-secondary)' }}>
                                {detail.daysDelay != null && detail.daysDelay > 0 ? 'Delayed' : detail.daysDelay != null && detail.daysDelay < 0 ? 'Accelerated' : 'On time'}
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
                        </>
                      )}
                      {isChurn && (
                        <>
                          <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>{detail.currency ?? '—'}</td>
                          <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>{detail.revenueComponent ?? '—'}</td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.actualValue != null && isFinite(detail.actualValue) ? formatMoney(detail.actualValue) : '—'}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.planValue != null && isFinite(detail.planValue) ? formatMoney(detail.planValue) : '—'}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {detail.variance != null && isFinite(detail.variance) ? formatMoney(detail.variance) : '—'}
                          </td>
                          <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: 'var(--sales-text-secondary)' }}>{detail.churnReason ?? detail.comment ?? '—'}</td>
                        </>
                      )}
                      {isFX && (
                        <>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {(detail.planFxRate != null ? detail.planFxRate : planFX).toFixed(4)}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {detail.fxRate != null ? detail.fxRate.toFixed(4) : '—'}
                          </td>
                          <td className={`num ${(detail.fxChange ?? 0) >= 0 ? 'pos' : 'neg'}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: (detail.fxChange ?? 0) >= 0 ? '#0d9488' : '#dc2626'
                          }}>
                            {detail.fxChange != null ? ((detail.fxChange > 0 ? '+' : '') + detail.fxChange.toFixed(4)) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: 'var(--sales-text-secondary)' }}>
                            {detail.fxChange != null ? ((detail.fxChange >= 0 ? 'Appreciation' : 'Depreciation')) : '—'}
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
                      {isFixedFee && (
                        <>
                          <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>{detail.currency ?? '—'}</td>
                          <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>{detail.revenueComponent ?? '—'}</td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatMoney(detail.planValue ?? 0)}
                          </td>
                          <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                            {formatMoney(detail.actualValue ?? 0)}
                          </td>
                          <td className={`num ${cls}`} style={{ 
                            textAlign: 'right', 
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: cls === 'pos' ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(detail.variance ?? 0)}
                          </td>
                          <td style={{ fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', color: 'var(--sales-text-secondary)' }}>{detail.comment ?? '—'}</td>
                        </>
                      )}
                      {!isFixedFee && !isVolume && !isPrice && !isTiming && !isChurn && !isFX && (
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
              {!isPrice && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--sales-border)', fontWeight: '700' }}>
                  <td style={{ fontWeight: '700', color: 'var(--sales-text)' }}>Total</td>
                  {isFixedFee && (
                    <>
                      <td colSpan={2}></td>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {formatMoney(sortedDetails.reduce((sum, d) => sum + (d.planValue ?? 0), 0))}
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {formatMoney(sortedDetails.reduce((sum, d) => sum + (d.actualValue ?? 0), 0))}
                      </td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif', fontWeight: '700', color: totalVariance >= 0 ? '#0d9488' : '#dc2626' }}>
                        {formatMoney(totalVariance)}
                      </td>
                      <td></td>
                    </>
                  )}
                  {isVolume && (
                    <>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {sortedDetails.reduce((sum, d) => sum + (d.planVolume || 0), 0).toLocaleString()}
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {sortedDetails.reduce((sum, d) => sum + (d.actualVolume || 0), 0).toLocaleString()}
                      </td>
                      <td className={`num ${(() => {
                        const totalVolumeDelta = sortedDetails.reduce((sum, d) => sum + ((d.actualVolume || 0) - (d.planVolume || 0)), 0);
                        return totalVolumeDelta >= 0 ? 'pos' : 'neg';
                      })()}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: (() => {
                          const totalVolumeDelta = sortedDetails.reduce((sum, d) => sum + ((d.actualVolume || 0) - (d.planVolume || 0)), 0);
                          return totalVolumeDelta >= 0 ? '#0d9488' : '#dc2626';
                        })()
                      }}>
                        {(() => {
                          const totalVolumeDelta = sortedDetails.reduce((sum, d) => sum + ((d.actualVolume || 0) - (d.planVolume || 0)), 0);
                          return (totalVolumeDelta > 0 ? '+' : '') + totalVolumeDelta.toLocaleString();
                        })()}
                      </td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatPct(sortedDetails.reduce((sum, d) => {
                          const volumeDelta = (d.actualVolume || 0) - (d.planVolume || 0);
                          const planVol = d.planVolume || 1;
                          return sum + (planVol !== 0 ? volumeDelta / planVol : 0);
                        }, 0) / (sortedDetails.length || 1) * 100)}
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
                      {timingExcelLike ? (
                        <>
                          <td colSpan={5}></td>
                          <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{
                            textAlign: 'right',
                            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                            fontWeight: '700',
                            color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                          }}>
                            {formatMoney(totalVariance)}
                          </td>
                          <td></td>
                        </>
                      ) : (
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
                    </>
                  )}
                  {isChurn && (
                    <>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className={`num ${totalVariance >= 0 ? 'pos' : 'neg'}`} style={{ 
                        textAlign: 'right', 
                        fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
                        fontWeight: '700',
                        color: totalVariance >= 0 ? '#0d9488' : '#dc2626'
                      }}>
                        {formatMoney(totalVariance)}
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
                  {!isFixedFee && !isVolume && !isPrice && !isTiming && !isChurn && !isFX && (
                    <>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {formatMoney(sortedDetails.reduce((sum, d) => sum + (d.planValue || 0), 0))}
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif' }}>
                        {formatMoney(sortedDetails.reduce((sum, d) => sum + (d.actualValue || 0), 0))}
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
                        {formatPct(totalVariance / (sortedDetails.reduce((sum, d) => sum + (d.planValue || 0), 0) || 1))}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
              )}
            </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
