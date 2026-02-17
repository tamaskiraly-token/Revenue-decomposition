import { useEffect, useRef, useMemo, useState } from 'react';
import { DriverDetailModal, type ClientDetail } from './DriverDetailModal';

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
}

export function VarianceBridge({ steps, viewType = 'monthly' }: VarianceBridgeProps) {
  const [selectedStep, setSelectedStep] = useState<BridgeStep | null>(null);
  const stepsRef = useRef<BridgeStep[]>([]);
  
  // Transform steps based on viewType
  const transformedSteps = useMemo(() => {
    if (viewType === 'monthly') {
      stepsRef.current = steps;
      return steps;
    }
    // For quarterly/annual cumulative, we would aggregate data here
    // For now, return steps as-is (can be enhanced with actual aggregation logic)
    stepsRef.current = steps;
    return steps;
  }, [steps, viewType]);
  const svgRef = useRef<SVGSVGElement>(null);

  const formatMoney = (x: number, cur = '$') => {
    const sign = x < 0 ? '-' : '';
    const v = Math.abs(x);
    if (v >= 1e6) return `${sign}${cur}${(v / 1e6).toFixed(2)}m`;
    if (v >= 1e3) return `${sign}${cur}${(v / 1e3).toFixed(1)}k`;
    return `${sign}${cur}${v.toFixed(0)}`;
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const W = 1200;
    const H = 600; // Increased height for better vertical space utilization
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    const padL = 80;
    const padR = 40;
    const padT = 50;
    const padB = 80;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    // Compute running totals
    let running = 0;
    const series = steps.map((s, i) => {
      if (i === 0) {
        running = s.value;
        return { ...s, start: 0, end: s.value, isTotal: true };
      }
      if (i === steps.length - 1) {
        return { ...s, start: 0, end: s.value, isTotal: true };
      }
      const start = running;
      const end = running + s.value;
      running = end;
      return { ...s, start, end, isTotal: false };
    });

    const minY = Math.min(...series.map((s) => Math.min(s.start, s.end, s.value)));
    const maxY = Math.max(...series.map((s) => Math.max(s.start, s.end, s.value)));
    const span = maxY - minY || 1;
    const yMin = Math.max(0, minY - span * 0.1);
    const yMax = maxY + span * 0.15;

    const yScale = (v: number) => {
      const t = (v - yMin) / (yMax - yMin);
      return padT + (1 - t) * innerH;
    };

    const n = series.length;
    const gap = 20;
    const barW = (innerW - gap * (n - 1)) / n;

    // Gridlines - dotted style
    const glCount = 4;
    for (let i = 0; i <= glCount; i++) {
      const gv = yMin + (yMax - yMin) * (i / glCount);
      const y = yScale(gv);
      
      // Dotted gridline
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padL.toString());
      line.setAttribute('x2', (W - padR).toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', 'rgba(30, 27, 75, 0.08)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4,4');
      svg.appendChild(line);

      // Y-axis label
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', (padL - 10).toString());
      tx.setAttribute('y', (y + 4).toString());
      tx.setAttribute('text-anchor', 'end');
      tx.setAttribute('fill', 'rgba(30, 27, 75, 0.6)');
      tx.setAttribute('font-size', '12');
      tx.setAttribute('font-family', '"DM Sans", ui-sans-serif, system-ui, sans-serif');
      tx.setAttribute('font-weight', '500');
      tx.textContent = formatMoney(gv);
      svg.appendChild(tx);
    }

    // Bars
    for (let i = 0; i < n; i++) {
      const s = series[i];
      const x = padL + i * (barW + gap);

      let y0: number, y1: number;
      let fill: string;
      if (!s.isTotal) {
        y0 = yScale(s.start);
        y1 = yScale(s.end);
        fill = s.value >= 0 ? '#0d9488' : '#dc2626';
      } else {
        y0 = yScale(0);
        y1 = yScale(s.value);
        fill = '#1e1b4b';
      }

      const top = Math.min(y0, y1);
      const height = Math.abs(y1 - y0);

      // Bar with rounded top
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', top.toString());
      rect.setAttribute('width', barW.toString());
      rect.setAttribute('height', Math.max(2, height).toString());
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
      rect.setAttribute('fill', fill);
      rect.setAttribute('stroke', 'none');
      if (!s.isTotal && s.clientDetails && s.clientDetails.length > 0) {
        rect.setAttribute('style', 'cursor: pointer;');
        rect.setAttribute('data-step-index', i.toString());
      }
      svg.appendChild(rect);

      // Connector lines between bars (for waterfall effect)
      if (i > 0 && i < n - 1) {
        const currStart = s.start;
        const yConn = yScale(currStart);
        const x1 = x - gap;
        const conn = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        conn.setAttribute('x1', (x1 + barW).toString());
        conn.setAttribute('x2', x.toString());
        conn.setAttribute('y1', yConn.toString());
        conn.setAttribute('y2', yConn.toString());
        conn.setAttribute('stroke', 'rgba(30, 27, 75, 0.2)');
        conn.setAttribute('stroke-width', '2');
        svg.appendChild(conn);
      }

      // Value label at top of bar
      const displayValue = s.isTotal ? s.value : s.value;
      const vLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      vLbl.setAttribute('x', (x + barW / 2).toString());
      vLbl.setAttribute('y', (top - 12).toString());
      vLbl.setAttribute('text-anchor', 'middle');
      vLbl.setAttribute('fill', '#1e1b4b');
      vLbl.setAttribute('font-size', '14');
      vLbl.setAttribute('font-family', '"DM Sans", ui-sans-serif, system-ui, sans-serif');
      vLbl.setAttribute('font-weight', '700');
      vLbl.textContent = formatMoney(displayValue);
      svg.appendChild(vLbl);

      // X-axis label
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

    // Add click handlers to bars - cleanup old listeners first
    if (svgRef.current) {
      // Remove old event listeners by cloning the SVG
      const oldBars = svgRef.current.querySelectorAll('rect[data-step-index]');
      oldBars.forEach((bar) => {
        const newBar = bar.cloneNode(true);
        bar.parentNode?.replaceChild(newBar, bar);
      });

      const bars = svgRef.current.querySelectorAll('rect[data-step-index]');
      bars.forEach((bar) => {
        const clickHandler = () => {
          const idx = parseInt(bar.getAttribute('data-step-index') || '0', 10);
          const step = stepsRef.current[idx];
          if (step && step.clientDetails && Array.isArray(step.clientDetails) && step.clientDetails.length > 0) {
            setSelectedStep(step);
          }
        };
        bar.addEventListener('click', clickHandler);
        bar.addEventListener('mouseenter', () => {
          (bar as SVGElement).setAttribute('opacity', '0.8');
        });
        bar.addEventListener('mouseleave', () => {
          (bar as SVGElement).setAttribute('opacity', '1');
        });
      });
    }
  }, [transformedSteps]);

  return (
    <div className="sales-chart-card" style={{ background: '#ffffff' }}>
      <div className="sales-chart-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(30, 27, 75, 0.08)' }}>
        <div>
          <div className="sales-chart-title" style={{ fontSize: '18px', fontWeight: '700', color: '#1e1b4b', marginBottom: '6px' }}>
            Variance Bridge (Waterfall)
          </div>
          <div className="sales-chart-sub" style={{ fontSize: '13px', color: 'rgba(30, 27, 75, 0.6)', lineHeight: '1.4' }}>
            Plan → drivers → Actual (reporting currency). Bridge sequencing: Plan → Volume @ plan price → Price @ actual volume → Timing → Unknown churn → FX → Actual.
            {viewType !== 'monthly' && ` Showing ${viewType.replace('-', ' ')} view.`}
          </div>
        </div>
      </div>
      <div className="sales-chart-body" style={{ padding: '24px', minHeight: '650px' }}>
        <div style={{ width: '100%', overflow: 'auto', paddingBottom: '6px' }}>
          <svg ref={svgRef} width="1200" height="600" viewBox="0 0 1200 600" style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '600px' }}></svg>
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
