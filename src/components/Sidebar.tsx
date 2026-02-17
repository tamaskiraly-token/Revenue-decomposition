export type SalesTabId =
  | 'existing-clients'
  | 'new-clients';

const TABS: { id: SalesTabId; label: string }[] = [
  { id: 'existing-clients', label: 'Existing Clients' },
  { id: 'new-clients', label: 'New Clients' },
];

interface TopNavProps {
  activeTab: SalesTabId;
  onTabChange: (tab: SalesTabId) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export function Sidebar({ activeTab, onTabChange, selectedMonth, onMonthChange }: TopNavProps) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const months: { value: string; label: string }[] = [];
  
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ value, label });
  }

  return (
    <nav className="sales-top-nav">
      <div className="sales-top-nav-brand">
        <img 
          src="/token-logo.png" 
          alt="Token" 
          className="sales-top-nav-logo"
          onError={(e) => {
            // Fallback if logo doesn't exist
            const target = e.target as HTMLImageElement;
            target.src = '/token-logo.svg';
          }}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            objectFit: 'contain',
            flexShrink: 0
          }} 
        />
        <div>
          <div className="sales-top-nav-title">Revenue Decomposition</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="month-selector" style={{ fontSize: '12px', color: 'var(--sales-muted)', fontWeight: '600' }}>
            Month:
          </label>
          <select
            id="month-selector"
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="sales-filter-select"
            style={{ minWidth: '140px' }}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sales-top-nav-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`sales-top-nav-tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
