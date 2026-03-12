import { useMemo } from 'react';

export interface VarianceTrendPoint {
  monthKey: string;
  label: string;
  variance: number;
}

interface VarianceTrendChartProps {
  points: VarianceTrendPoint[];
}

function formatMoney(x: number, cur = '$') {
  const sign = x < 0 ? '-' : '';
  const v = Math.abs(x);
  if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
  if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
  return `${sign}${cur}${v.toFixed(0)}`;
}

export function VarianceTrendChart({ points }: VarianceTrendChartProps) {
  const layout = useMemo(() => {
    const W = 380;
    const H = 200;
    const PAD = { left: 48, right: 24, top: 20, bottom: 32 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
    const getX = (i: number) => PAD.left + i * step;
    if (points.length === 0) return { path: '', scaleY: (_: number) => PAD.top + innerH / 2, zeroY: PAD.top + innerH / 2, PAD, getX, W, H, innerW, innerH };
    const values = points.map(p => p.variance);
    const maxAbs = Math.max(...values.map(Math.abs), 1);
    const scaleY = (v: number) => {
      const t = (v + maxAbs) / (2 * maxAbs);
      return PAD.top + innerH * (1 - t);
    };
    const zeroY = scaleY(0);
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${scaleY(p.variance)}`).join(' ');
    return { path: d, scaleY, zeroY, PAD, getX, W, H, innerW, innerH };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="sales-chart-card">
        <div className="sales-chart-header">
          <div className="sales-chart-title">Variance trend</div>
          <div className="sales-chart-sub">Revenue variance over time</div>
        </div>
        <div className="sales-chart-body" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--sales-muted)' }}>
          No trend data (select months with data)
        </div>
      </div>
    );
  }

  const { path, scaleY, zeroY, PAD, getX, W, H, innerW } = layout;

  return (
    <div className="sales-chart-card">
      <div className="sales-chart-header">
        <div className="sales-chart-title">Variance trend</div>
        <div className="sales-chart-sub">Revenue variance over time — trajectory vs plan</div>
      </div>
      <div className="sales-chart-body" style={{ padding: '20px 24px' }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: 420, overflow: 'visible' }} preserveAspectRatio="xMidYMid meet">
          <line x1={PAD.left} y1={zeroY} x2={PAD.left + innerW} y2={zeroY} stroke="var(--sales-border)" strokeWidth={1} strokeDasharray="3 3" />
          <path d={path} fill="none" stroke="var(--sales-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={p.monthKey}>
              <circle cx={getX(i)} cy={scaleY(p.variance)} r={5} fill={p.variance >= 0 ? '#0d9488' : '#dc2626'} stroke="#fff" strokeWidth={1.5} />
              <text x={getX(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--sales-muted)">{p.label}</text>
              <title>{`${p.label}: ${formatMoney(p.variance)}`}</title>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
