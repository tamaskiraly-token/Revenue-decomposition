import { useMemo, useState, useEffect } from 'react';
import { VarianceByDriverChart } from './charts/VarianceByDriverChart';
import { TopBottomContributorsChart } from './charts/TopBottomContributorsChart';
import { PlanVsActualScatterChart } from './charts/PlanVsActualScatterChart';
import { VarianceTrendChart } from './charts/VarianceTrendChart';
import { RevenueMixChart } from './charts/RevenueMixChart';
import { loadContributorsByClient } from '../data/revenueDataService';
import type { RevenueData } from '../data/mockData';
import type { VarianceTrendPoint } from './charts/VarianceTrendChart';
import type { RevenueMixSegment } from './charts/RevenueMixChart';
import type { ClientType } from '../config/sheets';

interface FPAChartsSectionProps {
  /** Current tab's revenue data (for drivers, client details, scatter) */
  revenueData: RevenueData;
  /** Variance by month for trend chart (e.g. Jan, Feb) */
  varianceTrendPoints: VarianceTrendPoint[];
  /** Revenue mix: existing and new clients for selected period */
  revenueMix: { existing: RevenueMixSegment | null; newClients: RevenueMixSegment | null };
  /** Current client type (existing / new) – used to load driver breakdowns for Top & bottom contributors */
  clientType: ClientType;
  /** Selected month key (e.g. 2026-01) – used when loading breakdowns */
  selectedMonth: string;
}

export function FPAChartsSection({ revenueData, varianceTrendPoints, revenueMix, clientType, selectedMonth }: FPAChartsSectionProps) {
  const [contributorsByClient, setContributorsByClient] = useState<Array<{ clientName: string; variance: number; planValue: number; actualValue: number }>>([]);
  const [contributorsLoading, setContributorsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContributorsLoading(true);
    loadContributorsByClient(clientType, selectedMonth).then((list) => {
      if (!cancelled) {
        setContributorsByClient(list);
        setContributorsLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setContributorsByClient([]);
        setContributorsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [clientType, selectedMonth]);

  const clientDetailsFromDrivers = useMemo(() => {
    const out: { clientName: string; variance: number }[] = [];
    for (const d of revenueData.drivers) {
      if (d.clientDetails && Array.isArray(d.clientDetails)) {
        for (const c of d.clientDetails) {
          out.push({ clientName: c.clientName ?? 'Unknown', variance: c.variance ?? 0 });
        }
      }
    }
    return out;
  }, [revenueData.drivers]);

  const clientDetailsForContributors = contributorsByClient.length > 0
    ? contributorsByClient.map(({ clientName, variance }) => ({ clientName, variance }))
    : clientDetailsFromDrivers;

  const scatterPoints = useMemo(() => {
    if (contributorsByClient.length > 0) {
      return contributorsByClient
        .filter(c => Number.isFinite(c.planValue) && Number.isFinite(c.actualValue))
        .map(c => ({ clientName: c.clientName, planValue: c.planValue, actualValue: c.actualValue, variance: c.variance }));
    }
    const out: { clientName: string; planValue: number; actualValue: number; variance?: number }[] = [];
    const seen = new Set<string>();
    for (const d of revenueData.drivers) {
      if (d.clientDetails && Array.isArray(d.clientDetails)) {
        for (const c of d.clientDetails) {
          const name = (c.clientName ?? '').trim() || 'Unknown';
          if (seen.has(name)) continue;
          seen.add(name);
          const plan = c.planValue ?? 0;
          const actual = c.actualValue ?? 0;
          if (Number.isFinite(plan) && Number.isFinite(actual)) {
            out.push({ clientName: name, planValue: plan, actualValue: actual, variance: c.variance });
          }
        }
      }
    }
    return out;
  }, [contributorsByClient, revenueData.drivers]);

  return (
    <section style={{ marginTop: '32px', paddingTop: '28px', borderTop: '1px solid var(--sales-border)' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--sales-text)', marginBottom: '8px' }}>
        Other charts
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--sales-muted)', marginBottom: '24px' }}>
        Variance by driver, top/bottom contributors, plan vs actual scatter, variance trend, and revenue mix.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
        <VarianceByDriverChart drivers={revenueData.drivers} />
        <TopBottomContributorsChart clientDetails={clientDetailsForContributors} loading={contributorsLoading} />
        <PlanVsActualScatterChart points={scatterPoints} loading={contributorsLoading} />
        <VarianceTrendChart points={varianceTrendPoints} />
        <RevenueMixChart existing={revenueMix.existing} newClients={revenueMix.newClients} />
      </div>
    </section>
  );
}
