import { useEffect, useRef, useMemo, useState } from 'react';
import { DriverDetailModal, type ClientDetail } from './DriverDetailModal';
import { fetchSheetCsv, parseBreakdownCsv, parseFixedFeeBreakdownCsv, parseChurnBreakdownCsv } from '../data/googleSheets';
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

interface VarianceBridgeProps {
  steps: BridgeStep[];
  viewType?: ViewType;
  clientType?: ClientType;
  selectedMonth?: string;
}

const TOP_N = 3;
const Y_AXIS_FLOOR = 500_000;

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
  const stepsRef = useRef<BridgeStep[]>([]);
  const prevStepsRef = useRef<BridgeStep[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const breakdownCacheRef = useRef<Record<string, ClientDetail[]>>({});
  const [chartSize, setChartSize] = useState({ w: 1200, h: 400 });

  const transformedSteps = useMemo(() => {
    stepsRef.current = steps;
    return steps;
  }, [steps, viewType]);

  const formatMoney = (x: number, cur = '$') => {
    const sign = x < 0 ? '-' : '';
    const v = Math.abs(x);
    const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    return `${sign}${cur}${nf.format(v)}`;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? {};
      if (width != null && width > 0) {
        setChartSize((prev) => ({ ...prev, w: Math.max(400, Math.floor(width)), h: prev.h }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getBreakdownForStep = async (step: BridgeStep): Promise<ClientDetail[]> => {
    if (step.clientDetails && step.clientDetails.length > 0) return step.clientDetails;
    // Include month in cacheKey so month-switch always refreshes breakdowns
    const cacheKey = `${clientType ?? ''}-${step.label}-${selectedMonth ?? ''}`;
    const cached = breakdownCacheRef.current[cacheKey];
    if (cached) return cached;
    const gid = getBreakdownGid(clientType, step.label);
    if (gid == null) return [];
    const csv = await fetchSheetCsv(gid);
    const details =
      step.label === 'Fixed fee difference' && selectedMonth
        ? parseFixedFeeBreakdownCsv(csv, selectedMonth)
        : step.label === 'Unknown churn' && selectedMonth
          ? parseChurnBreakdownCsv(csv, selectedMonth)
          : parseBreakdownCsv(csv, step.label, selectedMonth);
    if (details.length > 0) breakdownCacheRef.current[cacheKey] = details;
    return details;
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const W = chartSize.w;
    const H = chartSize.h;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    const padL = 92;
    const padR = 24;
    const padT = 36;
    const padB = 52;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    let running = 0;
    const series = transformedSteps.map((s, i) => {
      if (i === 0) {
        running = s.value;
        return { ...s, start: 0, end: s.value, isTotal: true };
      }
      if (i === transformedSteps.length - 1) {
        return { ...s, start: 0, end: s.value, isTotal: true };
      }
      const start = running;
      const end = running + s.value;
      running = end;
      return { ...s, start, end, isTotal: false };
    });

    // Build previous series (for smooth animations) using current yScale later.
    let prevSeriesByLabel: Record<string, { start: number; end: number; isTotal: boolean; value: number }> = {};
    if (prevStepsRef.current && prevStepsRef.current.length > 0) {
      let pr = 0;
      const prevSteps = prevStepsRef.current;
      for (let i = 0; i < prevSteps.length; i++) {
        const ps = prevSteps[i];
        if (i === 0) {
          pr = ps.value;
          prevSeriesByLabel[ps.label] = { start: 0, end: ps.value, isTotal: true, value: ps.value };
          continue;
        }
        if (i === prevSteps.length - 1) {
          prevSeriesByLabel[ps.label] = { start: 0, end: ps.value, isTotal: true, value: ps.value };
          continue;
        }
        const start = pr;
        const end = pr + ps.value;
        pr = end;
        prevSeriesByLabel[ps.label] = { start, end, isTotal: false, value: ps.value };
      }
    }

    const minY = Math.min(...series.map((s) => Math.min(s.start, s.end, s.value)));
    const maxY = Math.max(...series.map((s) => Math.max(s.start, s.end, s.value)));
    const span = maxY - minY || 1;
    // Existing clients: keep fixed 500k floor to align with main bridge.
    // New clients and other views: let the axis start closer to data (down to zero).
    const yMin = clientType === 'existing-clients' ? Y_AXIS_FLOOR : Math.min(0, minY);
    const yMax = Math.max(yMin + 1, maxY + span * 0.15);

    const yScale = (v: number) => {
      const t = (v - yMin) / (yMax - yMin);
      return padT + (1 - t) * innerH;
    };

    const n = series.length;
    const gapDriver = 20;
    const gapTotalDriver = 36;
    const gaps: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      gaps.push(i === 0 || i === n - 2 ? gapTotalDriver : gapDriver);
    }
    const totalGaps = gaps.reduce((a, b) => a + b, 0);
    const barW = (innerW - totalGaps) / n;

    for (let i = 0; i <= 4; i++) {
      const gv = yMin + (yMax - yMin) * (i / 4);
      const y = yScale(gv);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padL.toString());
      line.setAttribute('x2', (W - padR).toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', 'rgba(30, 27, 75, 0.08)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4,4');
      svg.appendChild(line);

      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', (padL - 14).toString());
      tx.setAttribute('y', (y + 4).toString());
      tx.setAttribute('text-anchor', 'end');
      tx.setAttribute('fill', 'rgba(30, 27, 75, 0.6)');
      tx.setAttribute('font-size', '12');
      tx.setAttribute('font-family', '"DM Sans", ui-sans-serif, system-ui, sans-serif');
      tx.setAttribute('font-weight', '500');
      tx.textContent = formatMoney(gv);
      svg.appendChild(tx);
    }

    const barX: number[] = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      barX.push(padL + acc);
      acc += barW + (gaps[i] ?? 0);
    }

    for (let i = 0; i < n; i++) {
      const s = series[i];
      const x = barX[i];

      let y0: number, y1: number;
      let fill: string;
      if (!s.isTotal) {
        y0 = yScale(s.start);
        y1 = yScale(s.end);
        fill = s.value >= 0 ? '#0d9488' : '#dc2626';
      } else {
        y0 = yScale(yMin);
        y1 = yScale(s.value);
        fill = '#1e1b4b';
      }

      const top = Math.min(y0, y1);
      const height = Math.abs(y1 - y0);

      const hasDetails = (s.clientDetails?.length ?? 0) > 0;
      const hasBreakdownTab = !!getBreakdownGid(clientType, s.label);
      const hasClick = !!(hasDetails || hasBreakdownTab);
      const isDriver = !s.isTotal;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());

      const prev = prevSeriesByLabel[s.label];
      const prevY0 = prev
        ? (prev.isTotal ? yScale(yMin) : yScale(prev.start))
        : yScale(yMin);
      const prevY1 = prev
        ? (prev.isTotal ? yScale(prev.value) : yScale(prev.end))
        : yScale(yMin);
      const prevTop = Math.min(prevY0, prevY1);
      const prevHeight = Math.abs(prevY1 - prevY0);

      rect.setAttribute('y', prevTop.toString());
      rect.setAttribute('width', barW.toString());
      rect.setAttribute('height', Math.max(2, prevHeight).toString());
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', 'none');
      if (hasClick) rect.setAttribute('style', 'cursor: pointer;');
      if (isDriver || hasClick) rect.setAttribute('data-step-index', i.toString());
      if (isDriver) rect.setAttribute('data-hoverable', '1');
      svg.appendChild(rect);

      // Animate rect to its final position/height
      try {
        rect.animate(
          [
            { y: `${prevTop}px`, height: `${Math.max(2, prevHeight)}px` },
            { y: `${top}px`, height: `${Math.max(2, height)}px` },
          ],
          { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        );
        // Ensure final attributes are set for layout/hit-testing
        rect.setAttribute('y', top.toString());
        rect.setAttribute('height', Math.max(2, height).toString());
      } catch {
        rect.setAttribute('y', top.toString());
        rect.setAttribute('height', Math.max(2, height).toString());
      }

      if (i > 0 && i < n - 1) {
        const currStart = s.start;
        const yConn = yScale(currStart);
        const x1 = barX[i - 1];
        const conn = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        conn.setAttribute('x1', (x1 + barW).toString());
        conn.setAttribute('x2', x.toString());
        conn.setAttribute('y1', yConn.toString());
        conn.setAttribute('y2', yConn.toString());
        conn.setAttribute('stroke', 'rgba(30, 27, 75, 0.2)');
        conn.setAttribute('stroke-width', '2');
        svg.appendChild(conn);

        // Connector line animation (fade-in + slight move)
        try {
          conn.setAttribute('opacity', '0.0');
          conn.animate(
            [{ opacity: 0, transform: 'translateY(-2px)' }, { opacity: 1, transform: 'translateY(0px)' }],
            { duration: 260, easing: 'ease-out', fill: 'forwards' }
          );
          conn.setAttribute('opacity', '1');
        } catch {
          conn.setAttribute('opacity', '1');
        }
      }

      const vLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      vLbl.setAttribute('x', (x + barW / 2).toString());
      vLbl.setAttribute('y', (top - 12).toString());
      vLbl.setAttribute('text-anchor', 'middle');
      vLbl.setAttribute('fill', '#1e1b4b');
      vLbl.setAttribute('font-size', '14');
      vLbl.setAttribute('font-family', '"DM Sans", ui-sans-serif, system-ui, sans-serif');
      vLbl.setAttribute('font-weight', '700');
      vLbl.textContent = formatMoney(s.value);
      svg.appendChild(vLbl);

      // Value label animation
      try {
        vLbl.setAttribute('opacity', '0.0');
        vLbl.animate(
          [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'translateY(0px)' }],
          { duration: 260, easing: 'ease-out', fill: 'forwards', delay: 80 }
        );
        vLbl.setAttribute('opacity', '1');
      } catch {
        vLbl.setAttribute('opacity', '1');
      }

      const xLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xLbl.setAttribute('x', (x + barW / 2).toString());
      xLbl.setAttribute('y', (H - padB + 20).toString());
      xLbl.setAttribute('text-anchor', 'middle');
      xLbl.setAttribute('fill', '#1e1b4b');
      xLbl.setAttribute('font-size', '13');
      xLbl.setAttribute('font-weight', '600');
      xLbl.textContent = s.label;
      svg.appendChild(xLbl);
    }

    // Save as previous for next update animation
    prevStepsRef.current = transformedSteps;

    if (svgRef.current) {
      const oldBars = svgRef.current.querySelectorAll('rect[data-step-index]');
      oldBars.forEach((bar) => {
        const newBar = bar.cloneNode(true);
        bar.parentNode?.replaceChild(newBar, bar);
      });

      const bars = svgRef.current.querySelectorAll('rect[data-step-index]');
      bars.forEach((bar) => {
        const idx = parseInt(bar.getAttribute('data-step-index') || '0', 10);
        const step = stepsRef.current[idx];
        const isHoverable = bar.hasAttribute('data-hoverable');

        const clickHandler = async () => {
          if (!step) return;
          if (step.clientDetails && Array.isArray(step.clientDetails) && step.clientDetails.length > 0) {
            setSelectedStep(step);
            return;
          }
          const gid = getBreakdownGid(clientType, step.label);
          if (gid == null) return;
          setLoadingBreakdown(true);
          try {
            const clientDetails = await getBreakdownForStep(step);
            setSelectedStep({ ...step, clientDetails });
          } catch {
            setSelectedStep({ ...step, clientDetails: [] });
          } finally {
            setLoadingBreakdown(false);
          }
        };

        const mouseEnterHandler = (e: MouseEvent) => {
          (bar as SVGElement).setAttribute('opacity', '0.8');
          if (!isHoverable || !step) return;
          const rect = (e.target as Element).getBoundingClientRect();
          const tooltipX = rect.left + rect.width / 2;
          const tooltipY = rect.top;
          setTooltipAnchor({ x: tooltipX, y: tooltipY });
          setTooltipLoading(true);
          getBreakdownForStep(step)
            .then((details) => {
              const isVolume = step.label.toLowerCase().includes('volume');
              const isPrice = step.label.toLowerCase().includes('price');
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
              const withVariance = details
                .filter((d) => d != null && isFinite(d.variance))
                .map((d) => ({ ...d, displayVariance: getDisplayVariance(d) }));
              const topPos = [...withVariance]
                .filter((d) => d.displayVariance > 0)
                .sort((a, b) => b.displayVariance - a.displayVariance)
                .slice(0, TOP_N)
                .map((d) => ({ name: d.clientName || '', value: d.displayVariance }));
              const topNeg = [...withVariance]
                .filter((d) => d.displayVariance < 0)
                .sort((a, b) => a.displayVariance - b.displayVariance)
                .slice(0, TOP_N)
                .map((d) => ({ name: d.clientName || '', value: d.displayVariance }));
              setHoverTooltip({
                stepLabel: step.label,
                stepValue: step.value,
                topPos,
                topNeg,
                x: tooltipX,
                y: tooltipY,
              });
            })
            .catch(() => setHoverTooltip(null))
            .finally(() => setTooltipLoading(false));
        };

        const mouseLeaveHandler = () => {
          (bar as SVGElement).setAttribute('opacity', '1');
          setHoverTooltip(null);
          setTooltipLoading(false);
          setTooltipAnchor(null);
        };

        bar.addEventListener('click', clickHandler);
        bar.addEventListener('mouseenter', mouseEnterHandler as EventListener);
        bar.addEventListener('mouseleave', mouseLeaveHandler);
      });
    }
  }, [transformedSteps, clientType, chartSize.w, chartSize.h]);

  return (
    <div
      className="sales-chart-card sales-waterfall-card"
      style={{ background: '#fff', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div
        className="sales-chart-header"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(30, 27, 75, 0.1)',
          flexShrink: 0,
        }}
      >
        <div>
          <div
            className="sales-chart-title"
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#334155',
              marginBottom: '4px',
              fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
            }}
          >
            Variance Bridge (Waterfall)
          </div>
          <div
            className="sales-chart-sub"
            style={{
              fontSize: '12px',
              color: 'rgba(51, 65, 85, 0.75)',
              lineHeight: '1.4',
              fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
            }}
          >
            Plan → drivers → Actual (reporting currency). Bridge: Plan → Fixed fee difference → Volume → Price →
            Timing → Unknown churn → FX → Residual → Actual.
            {viewType !== 'monthly' && ` Showing ${viewType.replace('-', ' ')} view.`}
          </div>
        </div>
      </div>
      <div
        className="sales-chart-body"
        style={{
          padding: '16px 20px',
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loadingBreakdown && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              borderRadius: '12px',
            }}
          >
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
                        <span
                          style={{
                            color: 'var(--sales-text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.name}
                        </span>
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
                        <span
                          style={{
                            color: 'var(--sales-text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {c.name}
                        </span>
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
        <div ref={containerRef} style={{ width: '100%', flex: 1, minHeight: 320, overflow: 'hidden' }}>
          <svg ref={svgRef} width="100%" height={chartSize.h} viewBox={`0 0 ${chartSize.w} ${chartSize.h}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block', verticalAlign: 'top' }} />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginTop: '16px',
            paddingTop: '4px',
            paddingBottom: '4px',
            fontSize: '12px',
            flexShrink: 0,
            fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#475569', display: 'inline-block' }} />
            <span>Start/End totals</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0d9488', display: 'inline-block' }} />
            <span>Positive driver</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#dc2626', display: 'inline-block' }} />
            <span>Negative driver</span>
          </div>
        </div>
      </div>
      {selectedStep &&
        selectedStep.clientDetails &&
        Array.isArray(selectedStep.clientDetails) && (
          <DriverDetailModal
            driverName={selectedStep.label}
            driverValue={selectedStep.value}
            clientDetails={selectedStep.clientDetails}
            onClose={() => setSelectedStep(null)}
            planFX={selectedStep.planFX || steps.find((s) => s.label === 'Plan')?.planFX || 1.0}
          />
        )}
    </div>
  );
}
