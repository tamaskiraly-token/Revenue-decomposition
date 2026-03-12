import { useMemo } from 'react';

export interface ScatterPoint {
  clientName: string;
  planValue: number;
  actualValue: number;
  variance?: number;
}

interface PlanVsActualScatterChartProps {
  points: ScatterPoint[];
  loading?: boolean;
}

const W = 400;
const H = 280;
const PAD = { left: 52, right: 16, top: 12, bottom: 40 };

function formatMoney(x: number, cur = '$') {
  const sign = x < 0 ? '-' : '';
  const v = Math.abs(x);
  if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
  if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
  return `${sign}${cur}${v.toFixed(0)}`;
}

export function PlanVsActualScatterChart({ points, loading = false }: PlanVsActualScatterChartProps) {
  const { scaleX, scaleY, innerW, innerH, data } = useMemo(() => {
    const filtered = points.filter(p => Number.isFinite(p.planValue) && Number.isFinite(p.actualValue));
    if (filtered.length === 0) return { scaleX: (_x: number) => 0, scaleY: (_y: number) => 0, innerW: W - PAD.left - PAD.right, innerH: H - PAD.top - PAD.bottom, data: [] };
    const allPlan = filtered.map(p => p.planValue);
    const allActual = filtered.map(p => p.actualValue);
    const minPlan = Math.min(...allPlan);
    const maxPlan = Math.max(...allPlan);
    const minActual = Math.min(...allActual);
    const maxActual = Math.max(...allActual);
    const min = Math.min(minPlan, minActual);
    const max = Math.max(maxPlan, maxActual);
    const pad = (max - min) * 0.05 || 1;
    const lo = min - pad;
    const hi = max + pad;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const scaleX = (x: number) => PAD.left + ((x - lo) / (hi - lo)) * innerW;
    const scaleY = (y: number) => PAD.top + innerH - ((y - lo) / (hi - lo)) * innerH;
    return { scaleX, scaleY, innerW, innerH, data: filtered, lo, hi };
  }, [points]);

  const diagonalStart = useMemo(() => {
    if (data.length === 0) return { x: PAD.left, y: PAD.top + innerH };
    const { lo, hi } = (() => {
      const all = data.flatMap(p => [p.planValue, p.actualValue]);
      const mn = Math.min(...all);
      const mx = Math.max(...all);
      const pad = (mx - mn) * 0.05 || 1;
      return { lo: mn - pad, hi: mx + pad };
    })();
    return { x: scaleX(lo), y: scaleY(lo), x2: scaleX(hi), y2: scaleY(hi) };
  }, [data, scaleX, scaleY, innerH]);

  return (
    <div className="sales-chart-card">
      <div className="sales-chart-header">
        <div className="sales-chart-title">Plan vs actual (clients)</div>
        <div className="sales-chart-sub">On target = on 45° line; above = overperformance, below = underperformance</div>
      </div>
      <div className="sales-chart-body" style={{ padding: '20px 24px' }}>
        {loading ? (
          <div style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sales-muted)', fontSize: '13px' }}>
            Loading…
          </div>
        ) : data.length === 0 ? (
          <div style={{ minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sales-muted)', fontSize: '13px' }}>
            No plan/actual client data
          </div>
        ) : (
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 420, overflow: 'visible' }}>
            <line x1={diagonalStart.x} y1={diagonalStart.y} x2={diagonalStart.x2} y2={diagonalStart.y2} stroke="var(--sales-border)" strokeWidth={1.5} strokeDasharray="4 4" />
            <text x={PAD.left + innerW - 4} y={PAD.top + 10} textAnchor="end" fontSize={10} fill="var(--sales-muted)">On target</text>
            {data.map((p, i) => {
              const x = scaleX(p.planValue);
              const y = scaleY(p.actualValue);
              const above = p.actualValue >= p.planValue;
              return (
                <g key={`${p.clientName}-${i}`}>
                  <circle cx={x} cy={y} r={6} fill={above ? '#0d9488' : '#dc2626'} stroke="#fff" strokeWidth={1.5} />
                  <title>{`${p.clientName}\nPlan: ${formatMoney(p.planValue)}\nActual: ${formatMoney(p.actualValue)}`}</title>
                </g>
              );
            })}
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="var(--sales-border)" strokeWidth={1} />
            <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="var(--sales-border)" strokeWidth={1} />
            <text x={PAD.left + innerW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--sales-muted)">Plan</text>
            <text x={12} y={PAD.top + innerH / 2} textAnchor="middle" fontSize={11} fill="var(--sales-muted)" transform={`rotate(-90, 12, ${PAD.top + innerH / 2})`}>Actual</text>
          </svg>
        )}
      </div>
    </div>
  );
}
