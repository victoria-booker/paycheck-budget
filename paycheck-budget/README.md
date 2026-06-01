# Paycheck Budget Tracker

A React + TypeScript personal finance app that solves a problem most budget tools miss — **budgeting by paycheck, not by month.**

Most apps show you a monthly view. But you don’t pay your bills monthly. You pay them with specific paychecks. This app automatically assigns every bill to the correct pay period based on its due date, so you always know exactly how much money you have left *after this paycheck covers its bills* — not after the whole month.

Built with AI-powered budget analysis that gives personalized insights, flags tight pay periods, and projects progress toward a savings goal.

-----

## Features

- **Biweekly pay period calculator** — generates pay periods automatically from your first pay date
- **Smart bill assignment** — each bill is assigned to the correct paycheck based on its due date, handles month boundaries cleanly
- **Multiple income sources** — supports biweekly paychecks and monthly deposits (e.g. government benefits, rental income) hitting on specific days
- **Rolling balance** — opening balance flows through each period so you see real projected remaining cash
- **Mark bills paid** — tap any bill to mark it paid and watch your real-time remaining balance update instantly
- **AI Budget Advisor** — powered by Claude API, analyzes your specific budget, flags tight periods, suggests bill rebalancing, and projects your savings timeline
- **Savings goal tracker** — visual progress bar toward any savings goal
- **Persistent storage** — all data saved locally, survives page refreshes
- **Mobile-first design** — built to be checked on your phone, not just a desktop

-----

## Tech Stack

|Layer           |Technology                                |
|----------------|------------------------------------------|
|Framework       |React 18                                  |
|Language        |TypeScript                                |
|Build Tool      |Vite                                      |
|AI Integration  |Anthropic Claude API                      |
|Styling         |Inline CSS with design tokens             |
|Storage         |localStorage                              |
|State Management|React hooks (useState, useEffect, useMemo)|

-----

## TypeScript Highlights

This project demonstrates practical TypeScript patterns including:

**Union types for constrained values** — preventing invalid states at compile time:

```typescript
type BillCategory =
  | "housing" | "utilities" | "transport" | "insurance"
  | "subscriptions" | "personal" | "debt" | "childcare" | "other";

type BudgetHealth = "good" | "fair" | "tight";
type TabId = "dashboard" | "bills" | "income" | "ai" | "settings";
```

**Interface composition** — extending base types with period-specific data:

```typescript
interface Bill {
  id: string;
  name: string;
  category: BillCategory;
  estimatedAmount: number;
  dayOfMonth: number;
  isActive: boolean;
}

// Bill extended with runtime data for a specific pay period
interface PayPeriodBill extends Bill {
  dueDate: string;
  actualAmount: number | null;
  isPaid: boolean;
}
```

**Typed component props** — no implicit any:

```typescript
interface PeriodCardProps {
  period: PayPeriod;
  isFirst: boolean;
  paidStatus: PaidStatus;
  togglePaid: (key: string) => void;
}

function PeriodCard({ period, isFirst, paidStatus, togglePaid }: PeriodCardProps) { ... }
```

**Typed async functions with explicit return types:**

```typescript
async function analyze(): Promise<void> { ... }
function addDays(dateStr: string, days: number): string { ... }
function formatMoney(amount: number): string { ... }
```

-----

## Core Logic

The most interesting part of this app is the bill-to-paycheck assignment algorithm. Given a biweekly pay period that can span two calendar months, it correctly assigns each bill to the period that contains its due date:

```typescript
function getBillsForPeriod(bills: Bill[], period: RawPayPeriod): PayPeriodBill[] {
  const start = new Date(period.startDate + "T12:00:00");
  const end = new Date(period.endDate + "T12:00:00");
  const sy = start.getFullYear(), sm = start.getMonth();
  const ey = end.getFullYear(),   em = end.getMonth();

  return bills
    .filter((bill) => {
      if (!bill.isActive) return false;
      // A period can span two months — check both
      const d1 = new Date(sy, sm, bill.dayOfMonth);
      const d2 = new Date(ey, em, bill.dayOfMonth);
      return (d1 >= start && d1 <= end) ||
             (sm !== em && d2 >= start && d2 <= end);
    })
    .map((bill) => { ... });
}
```

-----

## AI Integration

The AI Advisor tab calls the Anthropic Claude API with a structured prompt containing the user’s actual pay period data, bill breakdown, and savings goal. It returns a typed `AIAnalysis` object with health assessment, tight period warnings, rebalancing suggestions, and savings projections.

```typescript
interface AIAnalysis {
  overallHealth: BudgetHealth;
  healthSummary: string;
  tightPeriods: string[];
  rebalanceSuggestions: string[];
  savingsOpportunity: number;
  monthsToGoal: number;
  aiInsights: string[];
  encouragement: string;
}
```

-----

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Anthropic API key (for AI Advisor feature)

### Installation

```bash
# Clone the repo
git clone https://github.com/queenvb/paycheck-budget.git
cd paycheck-budget

# Install dependencies
npm install

# Add your Anthropic API key
cp .env.example .env
# Edit .env and add: VITE_ANTHROPIC_API_KEY=your_key_here

# Start the dev server
npm run dev
```

### Build for production

```bash
npm run build
npm run preview
```

-----

## Project Structure

```
src/
├── PaycheckBudget.tsx   # Main app component + all feature components
├── main.tsx             # React entry point
└── vite-env.d.ts        # Vite type declarations
```

-----

## Why I Built This

I’ve managed my personal budget in Google Sheets for years using a custom biweekly system — tracking which specific paycheck covers which bills rather than thinking in monthly totals. It works great but isn’t mobile-friendly or shareable.

This project is a full rebuild of that system as a modern React + TypeScript app, with AI-powered analysis layered on top. The core algorithm (assigning bills to pay periods across month boundaries) was the interesting engineering problem to solve cleanly in TypeScript.

-----

## License

MIT

-----

*Built by [Victoria Booker](https://github.com/victoria-booker) · Senior Full Stack Engineer*