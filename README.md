# Revenue Decomposition Dashboard

A comprehensive FP&A dashboard for revenue decomposition analysis, showing variance bridge between plan and actual revenue.

## Features

- **Performance Cards**: Key metrics including Plan Revenue, Actual Revenue, Variance, and FX rates
- **Variance Bridge**: Waterfall chart showing revenue decomposition into drivers (Volume, Price, Timing, Churn, FX, Other)
- **Driver Contribution Table**: Detailed breakdown of each driver's impact on variance
- **Summary Insights**: Positive highlights and challenges for the selected period
- **Multiple Views**: Monthly, Quarterly cumulative, and Annual cumulative views
- **Client Type Filtering**: Separate data for Existing Clients and New Clients
- **Interactive Details**: Click on drivers to see client-level breakdowns

## Technology Stack

- React + TypeScript
- Vite
- CSS3 with custom design system
- SVG for custom charts

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── Sidebar.tsx          # Top navigation bar
│   ├── PerformanceCards.tsx  # KPI cards
│   ├── VarianceBridge.tsx   # Waterfall chart
│   ├── DriverContribution.tsx # Driver table
│   ├── DriverDetailModal.tsx # Client detail popup
│   └── SummaryInsights.tsx  # Insights summary
├── data/
│   └── mockData.ts          # Data generation logic
├── App.tsx                  # Main application
└── sales-dashboard.css     # Styles
```

## Data Generation

The dashboard uses deterministic random data generation based on:
- Selected month
- Client type (Existing vs New)
- View type (Monthly, Quarterly, Annual)

Data is internally consistent and regenerates when filters change.

## License

Copyright © Token.io Limited
