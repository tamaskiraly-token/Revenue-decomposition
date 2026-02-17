
interface PerformanceCardsProps {
  planRec: number;
  actual: number;
  variance: number;
  varPct: number;
  planDelay: number;
  actualDelay: number;
  planFX: number;
  actualFX: number;
}

export function PerformanceCards({
  planRec,
  actual,
  variance,
  varPct,
  planDelay,
  actualDelay,
  planFX,
  actualFX,
}: PerformanceCardsProps) {
  const formatMoney = (x: number, cur = '$') => {
    const sign = x < 0 ? '-' : '';
    const v = Math.abs(x);
    if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
    if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
    return `${sign}${cur}${v.toFixed(0)}`;
  };

  const formatPct = (x: number) => {
    return `${(x * 100).toFixed(1)}%`;
  };

  return (
    <div className="sales-kpi-grid">
      <div className="sales-kpi-card">
        <div className="sales-kpi-label">Planned recognized revenue</div>
        <div className="sales-kpi-value">{formatMoney(planRec)}</div>
        <div className="sales-kpi-delta">
          <span className="dot neutral"></span>
          <span>Delay {formatPct(planDelay)} · FX {planFX.toFixed(4)}</span>
        </div>
      </div>
      <div className="sales-kpi-card">
        <div className="sales-kpi-label">Actual recognized revenue</div>
        <div className="sales-kpi-value">{formatMoney(actual)}</div>
        <div className="sales-kpi-delta">
          <span className="dot neutral"></span>
          <span>Delay {formatPct(actualDelay)} · FX {actualFX.toFixed(4)}</span>
        </div>
      </div>
      <div className="sales-kpi-card">
        <div className="sales-kpi-label">Variance (Actual − Plan)</div>
        <div className="sales-kpi-value">{formatMoney(variance)}</div>
        <div className={`sales-kpi-delta ${variance >= 0 ? 'up' : 'down'}`}>
          <span className={`dot ${variance >= 0 ? 'good' : 'bad'}`}></span>
          <span>{variance >= 0 ? 'Over' : 'Under'} plan by {formatMoney(Math.abs(variance))}</span>
        </div>
      </div>
      <div className="sales-kpi-card">
        <div className="sales-kpi-label">Variance %</div>
        <div className="sales-kpi-value">{formatPct(varPct)}</div>
        <div className={`sales-kpi-delta ${varPct >= 0 ? 'up' : 'down'}`}>
          <span className={`dot ${varPct >= 0 ? 'good' : 'bad'}`}></span>
          <span>vs plan {formatPct(varPct)}</span>
        </div>
      </div>
    </div>
  );
}
