// Mock data generator for revenue decomposition

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

export interface Insight {
  type: 'positive' | 'negative';
  text: string;
}

export interface RevenueData {
  planRec: number;
  actual: number;
  variance: number;
  varPct: number;
  planDelay: number;
  actualDelay: number;
  planFX: number;
  actualFX: number;
  drivers: Array<{
    name: string;
    value: number;
    note: string;
    clientDetails?: ClientDetail[];
  }>;
  bridgeSteps: Array<{
    label: string;
    value: number;
    kind: 'total' | 'delta';
    clientDetails?: ClientDetail[];
    planFX?: number;
  }>;
  insights: Insight[];
}

// Simple deterministic random number generator
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Generate data for a single month
function generateSingleMonthData(month: string, clientType: 'existing-clients' | 'new-clients', seed: string, monthOffset: number = 0): RevenueData {
  // Calculate the actual month for this offset
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1 + monthOffset, 1);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  
  const monthSeed = hashStringToSeed(seed + '|' + monthKey + '|' + clientType + '|' + monthOffset);
  const rand = mulberry32(monthSeed);
  
  // Store planFX for FX driver details
  let planFX: number;

  // Generate base values - different ranges for existing vs new clients
  let planRec: number;
  let variancePct: number;
  
  if (clientType === 'existing-clients') {
    // Existing clients: higher base, larger variance range for more visible differences
    planRec = 1200000 + rand() * 600000; // $1.2M - $1.8M
    variancePct = (rand() * 2 - 1) * 0.30; // -30% to +30% (larger variance for visibility)
  } else {
    // New clients: lower base, larger variance range
    planRec = 400000 + rand() * 300000; // $400k - $700k
    variancePct = (rand() * 2 - 1) * 0.25; // -25% to +25% (more volatile)
  }
  
  const actual = planRec * (1 + variancePct);

  const variance = actual - planRec;
  const varPct = planRec !== 0 ? variance / planRec : 0;

  // Timing delays
  const planDelay = 0.06 + rand() * 0.04; // 6-10%
  const actualDelay = Math.max(0.01, Math.min(0.20, planDelay + (rand() * 2 - 1) * 0.06));

  // FX rates
  planFX = 0.97 + rand() * 0.08;
  const actualFX = planFX * (0.94 + rand() * 0.12);

  // Drivers (decompose variance) - different distributions for existing vs new clients
  let vol: number, price: number, timing: number, churn: number, fx: number;
  
  if (clientType === 'existing-clients') {
    // Existing clients: larger driver impacts for more visible differences
    vol = variance * (0.25 + rand() * 0.20); // 25-45% of variance
    price = variance * (0.20 + rand() * 0.18); // 20-38% of variance
    timing = variance * (0.15 + rand() * 0.15); // 15-30% of variance
    churn = variance * (-0.30 + rand() * 0.20); // More churn impact: -10% to -30%
    fx = variance * (0.10 + rand() * 0.10); // 10-20% of variance
  } else {
    // New clients: volume is more significant, less churn (they're new!)
    vol = variance * (0.35 + rand() * 0.20);
    price = variance * (0.22 + rand() * 0.18);
    timing = variance * (0.15 + rand() * 0.15);
    churn = variance * (-0.05 + rand() * 0.05); // Minimal churn: -5% to 0%
    fx = variance * (0.08 + rand() * 0.08);
  }
  
  const other = variance - (vol + price + timing + churn + fx);

  // Generate client names based on type
  const clientNames = clientType === 'existing-clients' 
    ? ['Acme Corp', 'TechSolutions Inc', 'Global Systems Ltd', 'Enterprise Partners', 'Digital Ventures', 'Innovation Labs', 'Market Leaders Co', 'Strategic Alliance']
    : ['Startup Alpha', 'NewCo Beta', 'LaunchPad Gamma', 'Emerging Delta', 'Fresh Epsilon', 'Rising Zeta', 'Upstart Eta', 'Novel Theta'];

  // Generate client details for each driver - different data for different driver types
  const generateClientDetails = (driverValue: number, driverName: string, planFXRate: number): ClientDetail[] => {
    // Ensure driverValue is finite
    if (!isFinite(driverValue)) {
      return [];
    }
    
    const numClients = 6 + Math.floor(rand() * 3); // 6-8 clients
    const selectedClients = [...clientNames].sort(() => rand() - 0.5).slice(0, numClients);
    
    if (selectedClients.length === 0) {
      return [];
    }
    
    // Distribute the driver value across clients
    const clientValues: number[] = [];
    let remaining = driverValue;
    
    for (let i = 0; i < selectedClients.length - 1; i++) {
      const share = 0.1 + rand() * 0.25; // 10-35% per client
      const clientValue = driverValue * share;
      clientValues.push(isFinite(clientValue) ? clientValue : 0);
      remaining -= clientValue;
    }
    clientValues.push(isFinite(remaining) ? remaining : 0); // Last client gets the remainder
    
    return selectedClients.map((name, idx) => {
      const clientValue = clientValues[idx] || 0;
      const baseRevenue = planRec / selectedClients.length;
      
      if (driverName.includes('Volume')) {
        // Volume: show transaction count differences
        const planVolume = Math.round(10000 + rand() * 50000);
        const volumeChange = baseRevenue !== 0 ? clientValue / (baseRevenue / planVolume) : 0; // Approximate volume change
        const actualVolume = Math.round(planVolume + (isFinite(volumeChange) ? volumeChange : 0));
        const volumeDelta = actualVolume - planVolume;
        
        return {
          clientName: name,
          planValue: planVolume,
          actualValue: actualVolume,
          variance: clientValue, // Revenue impact, not volume delta
          variancePct: planVolume !== 0 ? volumeDelta / planVolume : 0,
          planVolume,
          actualVolume,
        };
      } else if (driverName.includes('Price')) {
        // Price: show price point differences
        const planPrice = 0.15 + rand() * 0.25; // $0.15 - $0.40 per transaction
        const priceChange = baseRevenue !== 0 && planPrice !== 0 ? clientValue / (baseRevenue / (baseRevenue / (planPrice * 10000))) : 0; // Approximate price change
        const actualPrice = planPrice + (isFinite(priceChange) ? priceChange : 0);
        
        return {
          clientName: name,
          planValue: planPrice,
          actualValue: isFinite(actualPrice) ? actualPrice : planPrice,
          variance: isFinite(actualPrice) ? actualPrice - planPrice : 0,
          variancePct: planPrice !== 0 && isFinite(actualPrice) ? (actualPrice - planPrice) / planPrice : 0,
          planPrice,
          actualPrice: isFinite(actualPrice) ? actualPrice : planPrice,
        };
      } else if (driverName.includes('Timing')) {
        // Timing: show implementation delays/accelerations
        const planDate = new Date(2026, 0, 15 + idx * 5); // Planned dates
        const daysDelay = Math.round((clientValue / baseRevenue) * 30); // Days delay based on variance
        const actualDate = new Date(planDate);
        actualDate.setDate(actualDate.getDate() + daysDelay);
        
        return {
          clientName: name,
          planValue: baseRevenue,
          actualValue: baseRevenue + clientValue,
          variance: clientValue,
          variancePct: baseRevenue !== 0 ? clientValue / baseRevenue : 0,
          planDate: planDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          actualDate: actualDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          daysDelay,
        };
      } else if (driverName.includes('churn')) {
        // Churn: show which clients churned and why
        const churnReasons = [
          'Contract cancellation',
          'Downgrade to lower tier',
          'Payment failure',
          'Competitor switch',
          'Service dissatisfaction',
          'Budget constraints',
        ];
        
        return {
          clientName: name,
          planValue: baseRevenue * (0.8 + rand() * 0.4),
          actualValue: baseRevenue * (0.8 + rand() * 0.4) + clientValue, // clientValue is negative
          variance: clientValue,
          variancePct: baseRevenue !== 0 ? clientValue / baseRevenue : 0,
          churnReason: churnReasons[Math.floor(rand() * churnReasons.length)],
        };
      } else if (driverName.includes('FX')) {
        // FX: show FX rate changes
        const baseFX = planFXRate;
        const fxChange = baseRevenue !== 0 ? (clientValue / baseRevenue) * baseFX : 0; // FX change impact
        const actualFXRate = baseFX + (isFinite(fxChange) ? fxChange : 0);
        
        return {
          clientName: name,
          planValue: baseRevenue,
          actualValue: baseRevenue + clientValue,
          variance: clientValue,
          variancePct: baseRevenue !== 0 ? clientValue / baseRevenue : 0,
          fxRate: isFinite(actualFXRate) ? actualFXRate : baseFX,
          fxChange: isFinite(fxChange) ? fxChange : 0,
        };
      } else {
        // Other/Residual: generic breakdown
        return {
          clientName: name,
          planValue: baseRevenue * (0.8 + rand() * 0.4),
          actualValue: baseRevenue * (0.8 + rand() * 0.4) + clientValue,
          variance: clientValue,
          variancePct: baseRevenue !== 0 ? clientValue / baseRevenue : 0,
        };
      }
    });
  };

  const drivers = [
    { 
      name: 'Volume (transactions)', 
      value: vol, 
      note: clientType === 'existing-clients' ? 'Δ transaction count vs plan @ plan price (existing customer activity)' : 'Δ transaction count vs plan @ plan price (new customer onboarding)',
      clientDetails: generateClientDetails(vol, 'Volume (transactions)', planFX),
    },
    { 
      name: 'Price point (avg price)', 
      value: price, 
      note: clientType === 'existing-clients' ? 'Δ price vs plan on actual volume (pricing changes for existing)' : 'Δ price vs plan on actual volume (pricing for new customers)',
      clientDetails: generateClientDetails(price, 'Price point (avg price)', planFX),
    },
    { 
      name: 'Timing (implementation / go-live)', 
      value: timing, 
      note: 'Recognized % vs plan (slippage or acceleration)',
      clientDetails: generateClientDetails(timing, 'Timing (implementation / go-live)', planFX),
    },
    { 
      name: 'Unknown churn', 
      value: churn, 
      note: clientType === 'existing-clients' ? 'Revenue lost from customer cancellations and downgrades' : 'Minimal churn impact (new customer cohort)',
      clientDetails: generateClientDetails(churn, 'Unknown churn', planFX),
    },
    { 
      name: 'FX (translation)', 
      value: fx, 
      note: 'Plan FX vs actual FX on actual recognized local',
      clientDetails: generateClientDetails(fx, 'FX (translation)', planFX),
    },
    { 
      name: 'Other / residual', 
      value: other, 
      note: 'Rounding + unmodeled effects (should be small)',
      clientDetails: generateClientDetails(other, 'Other / residual', planFX),
    },
  ];

  // Map driver details to bridge steps
  const driverMap: Record<string, ClientDetail[] | undefined> = {};
  drivers.forEach(driver => {
    const stepLabel = driver.name.includes('Volume') ? 'Volume' :
                     driver.name.includes('Price') ? 'Price' :
                     driver.name.includes('Timing') ? 'Timing' :
                     driver.name.includes('churn') ? 'Unknown churn' :
                     driver.name.includes('FX') ? 'FX' :
                     driver.name.includes('Other') ? 'Other' : '';
    if (stepLabel) {
      driverMap[stepLabel] = driver.clientDetails;
    }
  });

  const bridgeSteps = [
    { label: 'Plan', value: planRec, kind: 'total' as const, planFX },
    { label: 'Volume', value: vol, kind: 'delta' as const, clientDetails: driverMap['Volume'] },
    { label: 'Price', value: price, kind: 'delta' as const, clientDetails: driverMap['Price'] },
    { label: 'Timing', value: timing, kind: 'delta' as const, clientDetails: driverMap['Timing'] },
    { label: 'Unknown churn', value: churn, kind: 'delta' as const, clientDetails: driverMap['Unknown churn'] },
    { label: 'FX', value: fx, kind: 'delta' as const, clientDetails: driverMap['FX'], planFX },
    { label: 'Other', value: other, kind: 'delta' as const, clientDetails: driverMap['Other'] },
    { label: 'Actual', value: actual, kind: 'total' as const },
  ];

  // Generate insights based on the data
  const insights: Insight[] = [];
  
  // Positive insights
  if (vol > 0) {
    const topClients = clientNames.slice(0, Math.min(3, clientNames.length));
    insights.push({
      type: 'positive',
      text: `${topClients.join(', ')} and other top clients transacted above planned volume, contributing ${Math.abs(vol).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in additional revenue.`
    });
  }
  
  if (price > 0) {
    insights.push({
      type: 'positive',
      text: `Average transaction price exceeded plan by ${((price / planRec) * 100).toFixed(1)}%, indicating successful pricing optimization and upselling initiatives.`
    });
  }
  
  if (timing > 0) {
    insights.push({
      type: 'positive',
      text: `Implementation acceleration resulted in ${Math.abs(timing).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} of revenue being recognized earlier than planned.`
    });
  }
  
  if (actualDelay < planDelay) {
    insights.push({
      type: 'positive',
      text: `Actual implementation delay (${(actualDelay * 100).toFixed(1)}%) was below planned (${(planDelay * 100).toFixed(1)}%), indicating improved project execution.`
    });
  }
  
  // Check for clients that went live on time
  const timingDetails = driverMap['Timing'] || [];
  const onTimeClients = timingDetails.filter((cd: ClientDetail) => cd.daysDelay !== undefined && cd.daysDelay <= 0);
  if (onTimeClients.length > 0 && timingDetails.length > 0) {
    const onTimeCount = onTimeClients.length;
    insights.push({
      type: 'positive',
      text: `${onTimeCount} client${onTimeCount > 1 ? 's' : ''} went live on time or ahead of schedule, demonstrating strong implementation capabilities.`
    });
  }
  
  // Negative insights
  if (vol < 0) {
    insights.push({
      type: 'negative',
      text: `Transaction volume fell short of plan by ${Math.abs(vol).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}, primarily driven by lower activity from mid-tier clients.`
    });
  }
  
  if (price < 0) {
    insights.push({
      type: 'negative',
      text: `Average transaction price was ${Math.abs((price / planRec) * 100).toFixed(1)}% below plan, suggesting pricing pressure or mix shift toward lower-value transactions.`
    });
  }
  
  if (timing < 0) {
    insights.push({
      type: 'negative',
      text: `Implementation delays pushed ${Math.abs(timing).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} of revenue recognition into future periods.`
    });
  }
  
  if (churn < 0) {
    const churnDetails = driverMap['Unknown churn'] || [];
    if (churnDetails.length > 0) {
      const churnReasons = churnDetails.map((cd: ClientDetail) => cd.churnReason).filter(Boolean);
      const topReason = churnReasons[0] || 'contract cancellations';
      insights.push({
        type: 'negative',
        text: `Customer churn resulted in ${Math.abs(churn).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in lost revenue, with ${topReason} being the primary driver.`
      });
    }
  }
  
  if (actualDelay > planDelay * 1.2) {
    insights.push({
      type: 'negative',
      text: `Actual implementation delay (${(actualDelay * 100).toFixed(1)}%) significantly exceeded plan (${(planDelay * 100).toFixed(1)}%), indicating operational challenges in project delivery.`
    });
  }
  
  if (fx < 0 && Math.abs(fx) > planRec * 0.02) {
    insights.push({
      type: 'negative',
      text: `Unfavorable FX rate movements resulted in ${Math.abs(fx).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in translation losses, impacting international revenue recognition.`
    });
  }
  
  // Ensure we have at least 3 positive and 3 negative insights
  const positiveCount = insights.filter(i => i.type === 'positive').length;
  const negativeCount = insights.filter(i => i.type === 'negative').length;
  
  // Add generic positive insights if needed
  if (positiveCount < 3) {
    const genericPositives = [
      'Sales team exceeded quarterly targets for new client acquisition, adding 5+ strategic accounts.',
      'Product adoption rates increased by 15% among existing clients, driving higher engagement.',
      'Customer satisfaction scores reached an all-time high of 4.7/5.0, indicating strong service delivery.',
      'Partnership channel generated 20% more qualified leads than planned, expanding market reach.',
      'Operational efficiency improvements reduced cost per transaction by 8% compared to plan.'
    ];
    for (let i = positiveCount; i < 3 && i < genericPositives.length; i++) {
      insights.push({ type: 'positive', text: genericPositives[i] });
    }
  }
  
  // Add generic negative insights if needed
  if (negativeCount < 3) {
    const genericNegatives = [
      'Payment processing delays affected 3 major clients, causing temporary revenue recognition gaps.',
      'Competitive pressure forced price reductions on 2 key accounts, impacting margin expectations.',
      'Technical integration challenges delayed go-live for 4 enterprise clients by an average of 2 weeks.',
      'Regulatory compliance review required additional documentation, slowing down 3 contract renewals.',
      'Market volatility in key regions led to reduced transaction volumes from international clients.'
    ];
    for (let i = negativeCount; i < 3 && i < genericNegatives.length; i++) {
      insights.push({ type: 'negative', text: genericNegatives[i] });
    }
  }

  return {
    planRec,
    actual,
    variance,
    varPct,
    planDelay,
    actualDelay,
    planFX,
    actualFX,
    drivers,
    bridgeSteps,
    insights,
  };
}

// Aggregate multiple months of data
function aggregateMonths(months: RevenueData[]): RevenueData {
  if (months.length === 0) {
    throw new Error('Cannot aggregate empty months array');
  }
  if (months.length === 1) {
    return months[0];
  }

  // Validate all months have required data
  const validMonths = months.filter(m => 
    m && 
    m.drivers && 
    Array.isArray(m.drivers) && 
    m.drivers.length > 0 &&
    m.bridgeSteps &&
    Array.isArray(m.bridgeSteps) &&
    m.bridgeSteps.length > 0
  );

  if (validMonths.length === 0) {
    throw new Error('No valid months to aggregate');
  }

  // Sum up all values
  const aggregated: RevenueData = {
    planRec: validMonths.reduce((sum, m) => sum + (m.planRec || 0), 0),
    actual: validMonths.reduce((sum, m) => sum + (m.actual || 0), 0),
    variance: 0,
    varPct: 0,
    planDelay: validMonths[0].planDelay, // Use first month's delay
    actualDelay: validMonths[0].actualDelay,
    planFX: validMonths[0].planFX, // Use first month's FX
    actualFX: validMonths[0].actualFX,
    drivers: [],
    bridgeSteps: [],
    insights: [],
  };

  aggregated.variance = aggregated.actual - aggregated.planRec;
  aggregated.varPct = aggregated.planRec !== 0 ? aggregated.variance / aggregated.planRec : 0;

  // Aggregate drivers
  const driverMap: Record<string, { name: string; value: number; note: string; clientDetails?: ClientDetail[] }> = {};
  
  validMonths.forEach((monthData, monthIndex) => {
    monthData.drivers.forEach(driver => {
      if (!driverMap[driver.name]) {
        driverMap[driver.name] = {
          name: driver.name,
          value: 0,
          note: driver.note,
          clientDetails: [],
        };
      }
      driverMap[driver.name].value += driver.value;
      // Merge client details (combine all clients from all months)
      if (driver.clientDetails && Array.isArray(driver.clientDetails) && driver.clientDetails.length > 0) {
        const validDetails = driver.clientDetails.filter(cd => cd && cd.clientName && isFinite(cd.variance));
        driverMap[driver.name].clientDetails = [
          ...(driverMap[driver.name].clientDetails || []),
          ...validDetails.map(cd => ({
            ...cd,
            clientName: `${cd.clientName} (M${monthIndex + 1})`,
          })),
        ];
      }
    });
  });

  aggregated.drivers = Object.values(driverMap);

  // Aggregate bridge steps
  const otherDriver = aggregated.drivers.find(d => d.name.includes('Other'));
  aggregated.bridgeSteps = [
    { label: 'Plan', value: aggregated.planRec, kind: 'total' as const, planFX: aggregated.planFX },
    ...aggregated.drivers
      .filter(d => !d.name.includes('Other'))
      .map(d => {
        const stepLabel = d.name.includes('Volume') ? 'Volume' :
                         d.name.includes('Price') ? 'Price' :
                         d.name.includes('Timing') ? 'Timing' :
                         d.name.includes('churn') ? 'Unknown churn' :
                         d.name.includes('FX') ? 'FX' : '';
        return {
          label: stepLabel,
          value: d.value,
          kind: 'delta' as const,
          clientDetails: d.clientDetails,
          planFX: stepLabel === 'FX' ? aggregated.planFX : undefined,
        };
      })
      .filter(s => s.label !== ''),
    { 
      label: 'Other', 
      value: otherDriver?.value || 0, 
      kind: 'delta' as const,
      clientDetails: otherDriver?.clientDetails,
    },
    { label: 'Actual', value: aggregated.actual, kind: 'total' as const },
  ];

  // Aggregate insights from all months (combine unique insights)
  const allInsights: Insight[] = [];
  validMonths.forEach(month => {
    if (month.insights && Array.isArray(month.insights)) {
      month.insights.forEach(insight => {
        // Avoid duplicates
        if (!allInsights.some(i => i.text === insight.text)) {
          allInsights.push(insight);
        }
      });
    }
  });
  
  // Ensure we have at least 3 positive and 3 negative insights
  const positiveInsights = allInsights.filter(i => i.type === 'positive');
  const negativeInsights = allInsights.filter(i => i.type === 'negative');
  
  if (positiveInsights.length < 3) {
    const genericPositives = [
      'Sales team exceeded quarterly targets for new client acquisition, adding 5+ strategic accounts.',
      'Product adoption rates increased by 15% among existing clients, driving higher engagement.',
      'Customer satisfaction scores reached an all-time high of 4.7/5.0, indicating strong service delivery.',
      'Partnership channel generated 20% more qualified leads than planned, expanding market reach.',
      'Operational efficiency improvements reduced cost per transaction by 8% compared to plan.'
    ];
    for (let i = positiveInsights.length; i < 3 && i < genericPositives.length; i++) {
      allInsights.push({ type: 'positive', text: genericPositives[i] });
    }
  }
  
  if (negativeInsights.length < 3) {
    const genericNegatives = [
      'Payment processing delays affected 3 major clients, causing temporary revenue recognition gaps.',
      'Competitive pressure forced price reductions on 2 key accounts, impacting margin expectations.',
      'Technical integration challenges delayed go-live for 4 enterprise clients by an average of 2 weeks.',
      'Regulatory compliance review required additional documentation, slowing down 3 contract renewals.',
      'Market volatility in key regions led to reduced transaction volumes from international clients.'
    ];
    for (let i = negativeInsights.length; i < 3 && i < genericNegatives.length; i++) {
      allInsights.push({ type: 'negative', text: genericNegatives[i] });
    }
  }
  
  aggregated.insights = allInsights;

  return aggregated;
}

export function generateRevenueData(
  month: string, 
  clientType: 'existing-clients' | 'new-clients' = 'existing-clients', 
  viewType: 'monthly' | 'quarterly-cumulative' | 'annual-cumulative' = 'monthly',
  seed = 'FP&A-bridge'
): RevenueData {
  try {
    if (viewType === 'monthly') {
      return generateSingleMonthData(month, clientType, seed, 0);
    }

    // For quarterly/annual, generate multiple months and aggregate
    const numMonths = viewType === 'quarterly-cumulative' ? 3 : 12;
    const months: RevenueData[] = [];
    
    for (let i = 0; i < numMonths; i++) {
      const monthData = generateSingleMonthData(month, clientType, seed, -i);
      if (monthData && monthData.drivers && monthData.drivers.length > 0) {
        months.push(monthData);
      }
    }

    if (months.length === 0) {
      console.error('No valid months generated, falling back to monthly view');
      return generateSingleMonthData(month, clientType, seed, 0);
    }

    const aggregated = aggregateMonths(months);
    
    // Validate aggregated data
    if (!aggregated.drivers || aggregated.drivers.length === 0) {
      console.error('Aggregated drivers are empty, falling back to monthly view');
      return generateSingleMonthData(month, clientType, seed, 0);
    }
    
    if (!aggregated.bridgeSteps || aggregated.bridgeSteps.length === 0) {
      console.error('Aggregated bridgeSteps are empty, falling back to monthly view');
      return generateSingleMonthData(month, clientType, seed, 0);
    }

    return aggregated;
  } catch (error) {
    console.error('Error generating revenue data:', error);
    // Fallback to monthly view on error
    return generateSingleMonthData(month, clientType, seed, 0);
  }
}
