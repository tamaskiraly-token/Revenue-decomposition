import { useMemo, useState, useRef } from 'react';
import { DriverDetailModal, type ClientDetail } from './DriverDetailModal';
import { fetchSheetCsv, parseBreakdownCsv, parseFixedFeeBreakdownCsv } from '../data/googleSheets';
import { BREAKDOWN_GIDS, STEP_LABEL_TO_BREAKDOWN_KEY } from '../config/sheets';
import type { ClientType } from '../config/sheets';

function getBreakdownGid(clientType: ClientType | undefined, stepLabel: string): number | undefined {
  if (!clientType) return undefined;
  const gids = BREAKDOWN_GIDS[clientType] as Record<string, number>;
  const key = STEP_LABEL_TO_BREAKDOWN_KEY[stepLabel] ?? stepLabel;
  return gids[key];
}

export interface BridgeStep {
  label: string;
  value: number;
  kind: 'total' | 'delta';
  clientDetails?: ClientDetail[];
  planFX?: number;
}

export type ViewType = 'monthly' | 'quarterly-cumulative' | 'annual-cumulative';

const W = 1200;
const H = 600;
const padL = 80;
const padR = 40;
const padT = 50;
const padB = 80;
const innerW = W - padL - padR;
const innerH = H - padT - padB;

interface VarianceBridgeProps {
  steps: BridgeStep[];
  viewType?: ViewType;
  clientType?: ClientType;
  selectedMonth?: string;
}

function formatMoney(x: number, cur = '$') {
  const sign = x < 0 ? '-' : '';
  const v = Math.abs(x);
  if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
  if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
  return `${sign}${cur}${v.toFixed(0)}`;
}

const TOP_N = 3;

export function VarianceBridge({ steps, viewType = 'monthly', clientType, selectedMonth }: VarianceBridgeProps) {
  const [selectedStep, setSelectedStep] = useState<BridgeStep | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{
    stepLabel: string;
    stepValue: number;
    topPos: Array<{ name: string; value: number }>;
    topNeg: Array<{ name: string; value: number }>;
    x: number;
    y: number;
  } | null>(null);
  const [tooltipLoading, setTooltipLoading] = useState(false);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const breakdownCacheRef = useRef<Record<string, ClientDetail[]>>({});

  const transformedSteps = useMemo(() => {
    if (viewType === 'monthly') return steps;
    return steps;
  }, [steps, viewType]);

  const chartData = useMemo(() => {
    const s = transformedSteps;
    let running = 0;
    const series = s.map((step, i) => {
      if (i === 0) {
        running = step.value;
        return { ...step, start: 0, end: step.value, isTotal: true };
      }
      if (i === s.length - 1) {
        return { ...step, start: 0, end: step.value, isTotal: true };
      }
      const start = running;
      const end = running + step.value;
      running = end;
      return { ...step, start, end, isTotal: false };
    });

    const minY = Math.min(...series.map((x) => Math.min(x.start, x.end, x.value)));
    const maxY = Math.max(...series.map((x) => Math.max(x.start, x.end, x.value)));
    const span = maxY - minY || 1;
    // Y-axis starts at 500k so driver bars are visible; max = data max + padding
    const Y_AXIS_FLOOR = 500_000;
    const yMin = Y_AXIS_FLOOR;
    const yMax = maxY + Math.max(span * 0.12, 50_000);

    const yScale = (v: number) => {
      const t = (v - yMin) / (yMax - yMin);
      return padT + (1 - t) * innerH;
    };
    const clampToVisible = (v: number) => Math.max(yMin, Math.min(yMax, v));

    const n = series.length;
    const gap = 20;
    const barW = (innerW - gap * (n - 1)) / n;

    const gridLines = [];
    const glCount = 4;
    for (let i = 0; i <= glCount; i++) {
      const gv = yMin + (yMax - yMin) * (i / glCount);
      gridLines.push({ gv, y: yScale(gv) });
    }

    const barData: Array<{
      step: typeof series[0];
      stepIndex: number;
      x: number;
      top: number;
      height: number;
      width: number;
      fill: string;
      valueText: string;
      hasClick: boolean;
    }> = [];
    const connectors: Array<{ x1: number; x2: number; y: number }> = [];
    const xLabels: Array<{ x: number; y: number; text: string }> = [];

    for (let i = 0; i < n; i++) {
      const step = series[i];
      const x = padL + i * (barW + gap);

      let y0: number, y1: number;
      let fill: string;
      if (!step.isTotal) {
        y0 = yScale(step.start);
        y1 = yScale(step.end);
        fill = step.value >= 0 ? '#0d9488' : '#dc2626';
      } else {
        // Total bars (Plan/Actual): clamp to visible range so axis can start above 0
        const v0 = clampToVisible(0);
        const v1 = clampToVisible(step.value);
        y0 = yScale(v0);
        y1 = yScale(v1);
        fill = '#1e1b4b';
      }

      const top = Math.min(y0, y1);
      const height = Math.max(2, Math.abs(y1 - y0));

      const hasDetails = !step.isTotal && (step.clientDetails?.length ?? 0) > 0;
      const hasBreakdownTab = !step.isTotal && !!getBreakdownGid(clientType, step.label);

      barData.push({
        step,
        stepIndex: i,
        x,
        top,
        height,
        width: barW,
        fill,
        valueText: formatMoney(step.value),
        hasClick: !!(hasDetails || hasBreakdownTab),
      });

      if (i > 0 && i < n - 1) {
        const yConn = yScale(clampToVisible(step.start));
        connectors.push({ x1: x - gap + barW, x2: x, y: yConn });
      }

      xLabels.push({ x: x + barW / 2, y: H - padB + 20, text: step.label });
    }

    return { gridLines, barData, connectors, xLabels };
  }, [transformedSteps, clientType]);

  const getBreakdownForStep = async (step: BridgeStep): Promise<ClientDetail[]> => {
    if (step.clientDetails && step.clientDetails.length > 0) return step.clientDetails;
    const cacheKey = `${clientType ?? ''}-${step.label}-${step.label === 'Fixed fee difference' ? (selectedMonth ?? '') : ''}`;
    const cached = breakdownCacheRef.current[cacheKey];
    if (cached) return cached;
    const gid = getBreakdownGid(clientType, step.label);
    if (gid == null) return [];
    const csv = await fetchSheetCsv(gid);
    const details = step.label === 'Fixed fee difference' && selectedMonth
      ? parseFixedFeeBreakdownCsv(csv, selectedMonth)
      : parseBreakdownCsv(csv, step.label);
    if (details.length > 0) breakdownCacheRef.current[cacheKey] = details;
    return details;
  };

  const handleBarMouseEnter = (b: { step: BridgeStep; stepIndex: number }, e: React.MouseEvent<SVGRectElement>) => {
    if (!b.step || b.step.kind === 'total') return;
    const gid = getBreakdownGid(clientType, b.step.label);
    if (gid == null && !(b.step.clientDetails && b.step.clientDetails.length > 0)) return;
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top;
    setTooltipAnchor({ x: anchorX, y: anchorY });
    setTooltipLoading(true);
    getBreakdownForStep(b.step).then((details) => {
      const isVolume = b.step.label.toLowerCase().includes('volume');
      const isPrice = b.step.label.toLowerCase().includes('price');
      const getDisplayVariance = (d: ClientDetail) => {
        const raw = d.variance ?? 0;
        if (isVolume) {
          const volDelta = (d.actualVolume ?? d.actualValue ?? 0) - (d.planVolume ?? d.planValue ?? 0);
          return raw > 0 && volDelta < 0 ? -raw : raw;
        }
        if (isPrice) {
          const priceDelta = (d.actualPrice ?? d.actualValue ?? 0) - (d.planPrice ?? d.planValue ?? 0);
          return raw > 0 && priceDelta < 0 ? -raw : raw;
        }
        return raw;
      };
      const withVariance = details.filter((d) => d != null && isFinite(d.variance)).map((d) => ({ ...d, displayVariance: getDisplayVariance(d) }));
      const topPos = [...withVariance].filter((d) => d.displayVariance > 0).sort((a, b) => b.displayVariance - a.displayVariance).slice(0, TOP_N).map((d) => ({ name: d.clientName || '', value: d.displayVariance }));
      const topNeg = [...withVariance].filter((d) => d.displayVariance < 0).sort((a, b) => a.displayVariance - b.displayVariance).slice(0, TOP_N).map((d) => ({ name: d.clientName || '', value: d.displayVariance }));
      setHoverTooltip({
        stepLabel: b.step.label,
        stepValue: b.step.value,
        topPos,
        topNeg,
        x: anchorX,
        y: anchorY,
      });
    }).catch(() => setHoverTooltip(null)).finally(() => { setTooltipLoading(false); });
  };

  const handleBarMouseLeave = () => {
    setHoverTooltip(null);
    setTooltipLoading(false);
    setTooltipAnchor(null);
  };

  const handleBarClick = async (step: BridgeStep, _stepIndex: number) => {
    if (step.kind === 'total') return;
    if (step.clientDetails && Array.isArray(step.clientDetails) && step.clientDetails.length > 0) {
      setSelectedStep(step);
      return;
    }
    const gid = getBreakdownGid(clientType, step.label);
    if (gid == null) return;
    setLoadingBreakdown(true);
    try {
      const csv = await fetchSheetCsv(gid);
      const clientDetails = step.label === 'Fixed fee difference' && selectedMonth
        ? parseFixedFeeBreakdownCsv(csv, selectedMonth)
        : parseBreakdownCsv(csv, step.label);
      if (clientDetails.length > 0) {
        setSelectedStep({ ...step, clientDetails });
      }
    } catch (e) {
      console.warn('Failed to load breakdown for', step.label, e);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  return (
    <div className="sales-chart-card" style={{ background: '#ffffff' }}>
      <div className="sales-chart-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(30, 27, 75, 0.08)' }}>
        <div>
          <div className="sales-chart-title" style={{ fontSize: '18px', fontWeight: '700', color: '#1e1b4b', marginBottom: '6px' }}>
            Variance Bridge (Waterfall)
          </div>
          <div className="sales-chart-sub" style={{ fontSize: '13px', color: 'rgba(30, 27, 75, 0.6)', lineHeight: '1.4' }}>
            Plan → drivers → Actual (reporting currency). Bridge: Plan → Fixed fee difference → Volume → Price → Timing → Unknown churn → FX → Residual → Actual.
            {viewType !== 'monthly' && ` Showing ${viewType.replace('-', ' ')} view.`}
          </div>
        </div>
      </div>
      <div className="sales-chart-body" style={{ padding: '24px', minHeight: '650px', position: 'relative' }}>
        {loadingBreakdown && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '12px' }}>
            <span style={{ fontSize: '14px', color: 'var(--sales-text-secondary)' }}>Loading breakdown…</span>
          </div>
        )}
        {(hoverTooltip || (tooltipLoading && tooltipAnchor)) && (
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: hoverTooltip ? hoverTooltip.x : tooltipAnchor!.x,
              top: hoverTooltip ? hoverTooltip.y : tooltipAnchor!.y,
              transform: 'translate(-50%, calc(-100% - 8px))',
              zIndex: 50,
              minWidth: '200px',
              maxWidth: '320px',
              padding: '10px 12px',
              background: 'var(--sales-surface)',
              border: '1px solid var(--sales-border)',
              borderRadius: 'var(--sales-radius-sm)',
              boxShadow: 'var(--sales-shadow-hover)',
              fontSize: '12px',
              fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
              pointerEvents: 'none',
            }}
          >
            {tooltipLoading && !hoverTooltip && <span style={{ color: 'var(--sales-muted)' }}>Loading…</span>}
            {hoverTooltip && (
              <>
                <div style={{ fontWeight: '700', color: 'var(--sales-text)', marginBottom: '8px' }}>
                  {hoverTooltip.stepLabel}
                </div>
                {hoverTooltip.topPos.length > 0 && (
                  <div style={{ marginBottom: '6px' }}>
                    <div style={{ color: '#0d9488', fontWeight: '600', marginBottom: '2px' }}>Top 3 positive</div>
                    {hoverTooltip.topPos.map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--sales-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ color: '#0d9488', fontWeight: '600', flexShrink: 0 }}>{formatMoney(c.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {hoverTooltip.topNeg.length > 0 && (
                  <div>
                    <div style={{ color: '#dc2626', fontWeight: '600', marginBottom: '2px' }}>Top 3 negative</div>
                    {hoverTooltip.topNeg.map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ color: 'var(--sales-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ color: '#dc2626', fontWeight: '600', flexShrink: 0 }}>{formatMoney(c.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {hoverTooltip.topPos.length === 0 && hoverTooltip.topNeg.length === 0 && (
                  <span style={{ color: 'var(--sales-muted)' }}>No contributors</span>
                )}
              </>
            )}
          </div>
        )}
        <div style={{ width: '100%', overflow: 'auto', paddingBottom: '6px' }}>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '600px' }}
            className="sales-waterfall-svg"
          >
            <defs>
              <style>{`
                .sales-waterfall-bar {
                  transition: y 0.35s ease-out, height 0.35s ease-out, fill 0.25s ease-out;
                }
                .sales-waterfall-bar:hover {
                  opacity: 0.85;
                }
                .sales-waterfall-value {
                  transition: y 0.35s ease-out;
                }
                .sales-waterfall-connector {
                  transition: y 0.35s ease-out;
                }
              `}</style>
            </defs>
            {/* Gridlines */}
            {chartData.gridLines.map((gl, i) => (
              <g key={i}>
                <line
                  x1={padL}
                  x2={W - padR}
                  y1={gl.y}
                  y2={gl.y}
                  stroke="rgba(30, 27, 75, 0.08)"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <text
                  x={padL - 10}
                  y={gl.y + 4}
                  textAnchor="end"
                  fill="rgba(30, 27, 75, 0.6)"
                  fontSize={12}
                  fontFamily='"DM Sans", ui-sans-serif, system-ui, sans-serif'
                  fontWeight={500}
                >
                  {formatMoney(gl.gv)}
                </text>
              </g>
            ))}
            {/* Connectors */}
            {chartData.connectors.map((c, i) => (
              <line
                key={i}
                className="sales-waterfall-connector"
                x1={c.x1}
                x2={c.x2}
                y1={c.y}
                y2={c.y}
                stroke="rgba(30, 27, 75, 0.2)"
                strokeWidth={2}
              />
            ))}
            {/* Bars */}
            {chartData.barData.map((b) => (
              <g key={b.stepIndex}>
                <rect
                  className="sales-waterfall-bar"
                  x={b.x}
                  y={b.top}
                  width={b.width}
                  height={b.height}
                  rx={8}
                  ry={8}
                  fill={b.fill}
                  style={{ cursor: b.hasClick ? 'pointer' : 'default' }}
                  onClick={() => b.hasClick && handleBarClick(b.step, b.stepIndex)}
                  onMouseEnter={b.hasClick ? (e) => handleBarMouseEnter(b, e) : undefined}
                  onMouseLeave={b.hasClick ? handleBarMouseLeave : undefined}
                />
                <text
                  className="sales-waterfall-value"
                  x={b.x + b.width / 2}
                  y={b.top - 12}
                  textAnchor="middle"
                  fill="#1e1b4b"
                  fontSize={14}
                  fontFamily='"DM Sans", ui-sans-serif, system-ui, sans-serif'
                  fontWeight={700}
                >
                  {b.valueText}
                </text>
              </g>
            ))}
            {/* X-axis labels */}
            {chartData.xLabels.map((xl, i) => (
              <text
                key={i}
                x={xl.x}
                y={xl.y}
                textAnchor="middle"
                fill="#1e1b4b"
                fontSize={13}
                fontWeight={600}
              >
                {xl.text}
              </text>
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '20px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#1e1b4b', display: 'inline-block' }}></span>
            <span style={{ color: 'rgba(30, 27, 75, 0.7)' }}>Start/End totals</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#0d9488', display: 'inline-block' }}></span>
            <span style={{ color: 'rgba(30, 27, 75, 0.7)' }}>Positive driver</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#dc2626', display: 'inline-block' }}></span>
            <span style={{ color: 'rgba(30, 27, 75, 0.7)' }}>Negative driver</span>
          </div>
        </div>
      </div>
      {selectedStep && selectedStep.clientDetails && Array.isArray(selectedStep.clientDetails) && selectedStep.clientDetails.length > 0 && (
        <DriverDetailModal
          driverName={selectedStep.label}
          driverValue={selectedStep.value}
          clientDetails={selectedStep.clientDetails}
          onClose={() => setSelectedStep(null)}
          planFX={selectedStep.planFX || steps.find(s => s.label === 'Plan')?.planFX || 1.0}
        />
      )}
    </div>
  );
}
