
export interface Insight {
  type: 'positive' | 'negative';
  text: string;
}

interface SummaryInsightsProps {
  insights: Insight[];
  viewType: 'monthly' | 'quarterly-cumulative' | 'annual-cumulative';
}

export function SummaryInsights({ insights, viewType }: SummaryInsightsProps) {
  const positiveInsights = insights.filter(i => i.type === 'positive');
  const negativeInsights = insights.filter(i => i.type === 'negative');

  const periodLabel = viewType === 'monthly' 
    ? 'this month' 
    : viewType === 'quarterly-cumulative' 
    ? 'this quarter' 
    : 'this year';

  return (
    <div className="sales-chart-card">
      <div className="sales-chart-header">
        <div>
          <div className="sales-chart-title">Key Insights & Highlights</div>
          <div className="sales-chart-sub" style={{ fontSize: '13px', color: 'rgba(30, 27, 75, 0.6)', lineHeight: '1.4' }}>
            Summary of positive developments and challenges for {periodLabel}.
          </div>
        </div>
      </div>
      <div className="sales-chart-body" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Positive Insights */}
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid #0d9488'
            }}>
              <span style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '50%', 
                background: '#0d9488', 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: 'white',
                fontWeight: '700'
              }}>✓</span>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: '700', 
                color: '#0d9488',
                fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif'
              }}>
                Positive Highlights
              </h3>
            </div>
            {positiveInsights.length > 0 ? (
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {positiveInsights.map((insight, idx) => (
                  <li 
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(13, 148, 136, 0.08)',
                      borderRadius: '8px',
                      borderLeft: '3px solid #0d9488',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: 'var(--sales-text)',
                      fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif'
                    }}
                  >
                    {insight.text}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ 
                padding: '12px 16px',
                color: 'var(--sales-text-secondary)',
                fontSize: '14px',
                fontStyle: 'italic',
                fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif'
              }}>
                No positive highlights recorded.
              </div>
            )}
          </div>

          {/* Negative Insights */}
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid #dc2626'
            }}>
              <span style={{ 
                width: '16px', 
                height: '16px', 
                borderRadius: '50%', 
                background: '#dc2626', 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                color: 'white',
                fontWeight: '700'
              }}>!</span>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: '700', 
                color: '#dc2626',
                fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif'
              }}>
                Challenges & Risks
              </h3>
            </div>
            {negativeInsights.length > 0 ? (
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {negativeInsights.map((insight, idx) => (
                  <li 
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(220, 38, 38, 0.08)',
                      borderRadius: '8px',
                      borderLeft: '3px solid #dc2626',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: 'var(--sales-text)',
                      fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif'
                    }}
                  >
                    {insight.text}
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ 
                padding: '12px 16px',
                color: 'var(--sales-text-secondary)',
                fontSize: '14px',
                fontStyle: 'italic',
                fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif'
              }}>
                No challenges recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
