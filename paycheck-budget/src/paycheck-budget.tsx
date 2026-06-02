import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { storage } from "./storage";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type BillCategory =
  | "housing" | "utilities" | "transport" | "insurance"
  | "subscriptions" | "personal" | "debt" | "childcare" | "other";

type IncomeFrequency = "biweekly" | "monthly";

type BudgetHealth = "good" | "fair" | "tight";

type TabId = "dashboard" | "bills" | "income" | "ai" | "settings";

interface Bill {
  id: string;
  name: string;
  category: BillCategory;
  estimatedAmount: number;
  dayOfMonth: number;
  isActive: boolean;
}

interface PayPeriodBill extends Bill {
  dueDate: string;
  actualAmount: number | null;
  isPaid: boolean;
}

interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  biweeklyOffset?: number;
  monthlyDay?: number;
}

interface IncomeSourceWithDate extends IncomeSource {
  date: string;
}

interface RawPayPeriod {
  id: string;
  periodNumber: number;
  payDate: string;
  startDate: string;
  endDate: string;
}

interface PayPeriod extends RawPayPeriod {
  incomeSources: IncomeSourceWithDate[];
  bills: PayPeriodBill[];
  openingBalance: number;
  totalIncome: number;
  totalBills: number;
  closingBalance: number;
}

interface BudgetSettings {
  payFrequency: "biweekly";
  firstPayDate: string;
  currentBalance: number;
  savingsGoal: number;
  savingsGoalName: string;
  currentSavings: number;
}

interface PaidStatus {
  [key: string]: boolean;
}

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

interface TabItem {
  id: TabId;
  label: string;
  emoji: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES: BillCategory[] = [
  "housing", "utilities", "transport", "insurance",
  "subscriptions", "personal", "debt", "childcare", "other",
];

const CATEGORY_COLORS: Record<BillCategory, string> = {
  housing: "#8DA281", utilities: "#A7B77F", transport: "#5A8F72",
  insurance: "#7A8B7A", subscriptions: "#B1C69A", personal: "#CAD8AD",
  debt: "#CE8A78", childcare: "#8C9F82", other: "#9AA68F",
};

const BRAND = {
  espresso: "#1D2E27",
  espressoMid: "#284237",
  terracotta: "#5F977C",
  gold: "#9EB28D",
  cream: "#F5F3EA",
  warmWhite: "#E6EFE1",
  muted: "#6B7B6F",
  brown: "#768F7B",
  darkBrown: "#324335",
  green: "#7CAA92",
  red: "#D16F5E",
} as const;

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────

const DEFAULT_BILLS: Bill[] = [
  { id: "1",  name: "Mortgage",        category: "housing",       estimatedAmount: 2400, dayOfMonth: 1,  isActive: true },
  { id: "2",  name: "Electric",        category: "utilities",     estimatedAmount: 200,  dayOfMonth: 5,  isActive: true },
  { id: "3",  name: "Phone",           category: "utilities",     estimatedAmount: 106,  dayOfMonth: 8,  isActive: true },
  { id: "4",  name: "Car Loan 1",      category: "debt",          estimatedAmount: 449,  dayOfMonth: 10, isActive: true },
  { id: "5",  name: "Car Loan 2",      category: "debt",          estimatedAmount: 218,  dayOfMonth: 10, isActive: true },
  { id: "6",  name: "Internet",        category: "utilities",     estimatedAmount: 70,   dayOfMonth: 15, isActive: true },
  { id: "7",  name: "Auto Insurance",  category: "insurance",     estimatedAmount: 372,  dayOfMonth: 15, isActive: true },
  { id: "8",  name: "Life Insurance",  category: "insurance",     estimatedAmount: 56,   dayOfMonth: 20, isActive: true },
  { id: "9",  name: "Security System", category: "subscriptions", estimatedAmount: 47,   dayOfMonth: 20, isActive: true },
  { id: "10", name: "Car Wash",        category: "personal",      estimatedAmount: 31,   dayOfMonth: 21, isActive: true },
  { id: "11", name: "Storage Unit",    category: "other",         estimatedAmount: 68,   dayOfMonth: 22, isActive: true },
  { id: "12", name: "YouTube Premium", category: "subscriptions", estimatedAmount: 25,   dayOfMonth: 22, isActive: true },
  { id: "13", name: "Gym",             category: "personal",      estimatedAmount: 40,   dayOfMonth: 20, isActive: true },
  { id: "14", name: "Water",           category: "utilities",     estimatedAmount: 173,  dayOfMonth: 23, isActive: true },
  { id: "15", name: "Gas",             category: "utilities",     estimatedAmount: 85,   dayOfMonth: 8,  isActive: true },
  { id: "16", name: "Childcare",       category: "childcare",     estimatedAmount: 221,  dayOfMonth: 1,  isActive: true },
  { id: "17", name: "Childcare",       category: "childcare",     estimatedAmount: 221,  dayOfMonth: 8,  isActive: true },
];

const DEFAULT_INCOME: IncomeSource[] = [
  { id: "1", name: "My Paycheck",    amount: 4218, frequency: "biweekly", biweeklyOffset: 0 },
  { id: "2", name: "B's VA Benefit", amount: 2057, frequency: "monthly",  monthlyDay: 28 },
];

const DEFAULT_SETTINGS: BudgetSettings = {
  payFrequency: "biweekly",
  firstPayDate: "2026-05-09",
  currentBalance: 1500,
  savingsGoal: 30000,
  savingsGoalName: "Thailand Fund 🇹🇭",
  currentSavings: 0,
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function normalizeDate(date: Date): Date {
  const iso = date.toISOString().split("T")[0];
  return new Date(iso + "T12:00:00");
}

function getCurrentPeriodIndex(periods: RawPayPeriod[], date: Date): number {
  const normalized = normalizeDate(date);
  return periods.findIndex((period) => {
    const start = new Date(period.startDate + "T12:00:00");
    const end = new Date(period.endDate + "T12:00:00");
    return normalized >= start && normalized <= end;
  });
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function getOrdinalSuffix(n: number): string {
  return ["st", "nd", "rd"][n - 1] ?? "th";
}

function generatePayPeriods(settings: BudgetSettings, count: number = 4): RawPayPeriod[] {
  const periods: RawPayPeriod[] = [];
  let payDate = settings.firstPayDate;
  const today = normalizeDate(new Date());

  while (periods.length < count || getCurrentPeriodIndex(periods, today) === -1) {
    const index = periods.length;
    periods.push({
      id: `p${index}`,
      periodNumber: index + 1,
      payDate,
      startDate: payDate,
      endDate: addDays(payDate, 13),
    });
    payDate = addDays(payDate, 14);
  }

  const currentIndex = getCurrentPeriodIndex(periods, today);
  if (currentIndex === -1) {
    return periods.slice(0, count);
  }

  return periods.slice(currentIndex, currentIndex + count);
}

function getBillsForPeriod(bills: Bill[], period: RawPayPeriod): PayPeriodBill[] {
  const start = new Date(period.startDate + "T12:00:00");
  const end = new Date(period.endDate + "T12:00:00");
  const sy = start.getFullYear(), sm = start.getMonth();
  const ey = end.getFullYear(), em = end.getMonth();

  return bills
    .filter((bill) => {
      if (!bill.isActive) return false;
      const d1 = new Date(sy, sm, bill.dayOfMonth);
      const d2 = new Date(ey, em, bill.dayOfMonth);
      return (d1 >= start && d1 <= end) || (sm !== em && d2 >= start && d2 <= end);
    })
    .map((bill) => {
      const d1 = new Date(sy, sm, bill.dayOfMonth);
      const inFirst = d1 >= start && d1 <= end;
      const [yr, mo] = inFirst ? [sy, sm] : [ey, em];
      const dueDate = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(bill.dayOfMonth).padStart(2, "0")}`;
      return { ...bill, dueDate, actualAmount: null, isPaid: false };
    });
}

function getIncomeForPeriod(
  sources: IncomeSource[],
  period: RawPayPeriod
): IncomeSourceWithDate[] {
  const pStart = new Date(period.startDate + "T12:00:00");
  const pEnd = new Date(period.endDate + "T12:00:00");
  const result: IncomeSourceWithDate[] = [];

  sources.forEach((src) => {
    if (src.frequency === "biweekly") {
      result.push({ ...src, date: period.payDate });
    } else if (src.frequency === "monthly" && src.monthlyDay != null) {
      const m1 = pStart.getMonth(), y1 = pStart.getFullYear();
      const m2 = pEnd.getMonth(),   y2 = pEnd.getFullYear();
      const d1 = new Date(y1, m1, src.monthlyDay);
      const d2 = new Date(y2, m2, src.monthlyDay);
      const inFirst  = d1 >= pStart && d1 <= pEnd;
      const inSecond = m1 !== m2 && d2 >= pStart && d2 <= pEnd;
      if (inFirst || inSecond) {
        const [yr, mo] = inFirst ? [y1, m1] : [y2, m2];
        result.push({
          ...src,
          date: `${yr}-${String(mo + 1).padStart(2, "0")}-${String(src.monthlyDay).padStart(2, "0")}`,
        });
      }
    }
  });
  return result;
}

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

const labelSt: CSSProperties = {
  display: "block", fontSize: "0.68rem", letterSpacing: "0.15em",
  textTransform: "uppercase", color: BRAND.muted, marginBottom: "0.4rem",
};

const inputSt: CSSProperties = {
  width: "100%", padding: "0.65rem 0.75rem",
  background: "rgba(0,0,0,0.25)", border: "1px solid rgba(245,237,224,0.12)",
  borderRadius: 6, color: BRAND.cream, fontSize: "0.88rem",
  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

// ─── MINI STAT ────────────────────────────────────────────────────────────────

interface MiniStatProps {
  label: string;
  value: string | number;
  color?: string;
}

function MiniStat({ label, value, color = BRAND.muted }: MiniStatProps) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: "0.85rem", color }}>{value}</div>
      <div style={{ fontSize: "0.55rem", color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

// ─── PERIOD CARD ─────────────────────────────────────────────────────────────

interface PeriodCardProps {
  period: PayPeriod;
  isCurrent: boolean;
  paidStatus: PaidStatus;
  togglePaid: (key: string) => void;
}

function PeriodCard({ period, isCurrent, paidStatus, togglePaid }: PeriodCardProps) {
  const [expanded, setExpanded] = useState<boolean>(isCurrent);
  const pendingIncome = period.incomeSources
    .filter((src) => !paidStatus[`income-${period.id}-${src.id}`])
    .reduce((sum, src) => sum + src.amount, 0);
  const pendingBills = period.bills
    .filter((bill) => !paidStatus[`${period.id}-${bill.id}`])
    .reduce((sum, bill) => sum + bill.estimatedAmount, 0);
  const projectedBalance = period.openingBalance + pendingIncome - pendingBills;
  const isNegative = projectedBalance < 0;
  const isTight = projectedBalance < 500;
  const statusColor = isNegative ? BRAND.red : isTight ? BRAND.gold : BRAND.green;

  return (
    <div style={{ background: BRAND.warmWhite, borderRadius: 10, marginBottom: "1rem", overflow: "hidden", border: `1px solid ${statusColor}30` }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "1.1rem 1.25rem", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <div style={{ fontSize: "0.65rem", color: BRAND.gold, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                Paycheck {period.periodNumber}
              </div>
              {isCurrent && (
                <div style={{ fontSize: "0.63rem", color: BRAND.green, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Current period
                </div>
              )}
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "1.15rem", color: BRAND.darkBrown }}>{formatDate(period.payDate)}</div>
            <div style={{ fontSize: "0.75rem", color: BRAND.muted, marginTop: "0.15rem" }}>
              {formatDate(period.startDate)} — {formatDate(period.endDate)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.62rem", color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Projected Balance</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", color: statusColor }}>{formatMoney(projectedBalance)}</div>
            <div style={{ fontSize: "0.7rem", color: BRAND.muted }}>{period.bills.length} bills · {formatMoney(period.totalBills)}</div>
          </div>
        </div>
        <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.75rem" }}>
          <MiniStat label="Opening"  value={formatMoney(period.openingBalance)} />
          <span style={{ color: BRAND.muted, fontSize: "0.8rem", alignSelf: "flex-end", paddingBottom: "0.1rem" }}>+</span>
          <MiniStat label="Income"   value={formatMoney(pendingIncome)}    color={BRAND.green} />
          <span style={{ color: BRAND.muted, fontSize: "0.8rem", alignSelf: "flex-end", paddingBottom: "0.1rem" }}>−</span>
          <MiniStat label="Bills"    value={formatMoney(pendingBills)}     color={BRAND.terracotta} />
          <span style={{ color: BRAND.muted, fontSize: "0.8rem", alignSelf: "flex-end", paddingBottom: "0.1rem" }}>=</span>
          <MiniStat label="Left"     value={formatMoney(projectedBalance)} color={statusColor} />
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(245,237,224,0.07)", padding: "1rem 1.25rem" }}>
          {period.incomeSources.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.65rem", color: BRAND.green, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>Income This Period</div>
              {period.incomeSources.map((src, i) => {
                const incomeKey = `income-${period.id}-${src.id}`;
                const isReceived = !!paidStatus[incomeKey];
                return (
                  <div key={i} onClick={() => togglePaid(incomeKey)}
                    style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid rgba(245,237,224,0.05)", fontSize: "0.85rem", cursor: "pointer", opacity: isReceived ? 0.6 : 1, transition: "opacity 0.2s" }}>
                    <div>
                              <div style={{ fontWeight: 500, color: isReceived ? BRAND.muted : BRAND.darkBrown }}>{src.name}</div>
                              <div style={{ fontSize: "0.7rem", color: BRAND.muted }}>· {formatDate(src.date)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ color: BRAND.green, fontFamily: "Georgia, serif" }}>{formatMoney(src.amount)}</span>
                      <span style={{ fontSize: "1rem" }}>{isReceived ? "✅" : "⬜"}</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: "0.72rem", color: BRAND.muted, marginTop: "0.5rem" }}>Tap an income item if it is already included in your current balance.</div>
            </div>
          )}

          <div>
            <div style={{ fontSize: "0.65rem", color: BRAND.terracotta, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>Bills Due This Period</div>
            {period.bills.length === 0 ? (
              <div style={{ color: BRAND.muted, fontSize: "0.82rem", padding: "0.5rem 0" }}>No bills due this period 🎉</div>
            ) : (
              [...period.bills]
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .map((bill) => {
                  const paidKey = `${period.id}-${bill.id}`;
                  const isPaid = !!paidStatus[paidKey];
                  const catColor = CATEGORY_COLORS[bill.category];
                  return (
                    <div key={bill.id} onClick={() => togglePaid(paidKey)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(245,237,224,0.05)", cursor: "pointer", borderRadius: 4, opacity: isPaid ? 0.5 : 1, transition: "opacity 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: catColor, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: "0.85rem", textDecoration: isPaid ? "line-through" : "none", color: isPaid ? BRAND.muted : BRAND.darkBrown }}>{bill.name}</div>
                          <div style={{ fontSize: "0.68rem", color: BRAND.muted }}>Due {formatDate(bill.dueDate)} · {bill.category}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontFamily: "Georgia, serif", fontSize: "0.95rem", color: isPaid ? BRAND.muted : BRAND.darkBrown }}>{formatMoney(bill.estimatedAmount)}</span>
                        <span style={{ fontSize: "1rem" }}>{isPaid ? "✅" : "⬜"}</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          <div style={{ marginTop: "1rem", padding: "0.85rem", background: "rgba(0,0,0,0.2)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.65rem", color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Projected Balance After Pending Items</div>
              <div style={{ fontSize: "0.72rem", color: BRAND.muted, marginTop: "0.1rem" }}>Checked items are already included in your current balance.</div>
            </div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", color: projectedBalance < 0 ? BRAND.red : BRAND.gold }}>{formatMoney(projectedBalance)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

interface DashboardProps {
  periods: PayPeriod[];
  currentPeriodIndex: number;
  settings: BudgetSettings;
  updateSettings: (s: BudgetSettings) => void;
  paidStatus: PaidStatus;
  togglePaid: (key: string) => void;
}

function Dashboard({ periods, currentPeriodIndex, settings, updateSettings, paidStatus, togglePaid }: DashboardProps) {
  const [editBalance, setEditBalance] = useState<boolean>(false);
  const [tempBalance, setTempBalance] = useState<string>(String(settings.currentBalance));

  const saveBalance = (): void => {
    const val = parseFloat(tempBalance);
    if (!isNaN(val)) updateSettings({ ...settings, currentBalance: val });
    setEditBalance(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", fontWeight: 300, margin: 0 }}>Your Paychecks</h2>
          <div style={{ fontSize: "0.78rem", color: BRAND.muted, marginTop: "0.2rem" }}>Bills auto-sorted by pay period</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.62rem", color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Current Period Opening Balance</div>
          {editBalance ? (
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input value={tempBalance} onChange={(e) => setTempBalance(e.target.value)}
                style={{ width: 90, padding: "0.25rem 0.5rem", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(201,164,68,0.4)", borderRadius: 4, color: BRAND.cream, fontSize: "0.9rem", fontFamily: "inherit" }} />
              <button onClick={saveBalance} style={{ background: BRAND.terracotta, color: BRAND.cream, border: "none", borderRadius: 4, padding: "0.25rem 0.6rem", cursor: "pointer", fontSize: "0.75rem" }}>Save</button>
            </div>
          ) : (
            <div onClick={() => { setTempBalance(String(settings.currentBalance)); setEditBalance(true); }}
              style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", color: BRAND.gold, cursor: "pointer" }}>
              {formatMoney(settings.currentBalance)} ✏️
            </div>
          )}
        </div>
      </div>
      {periods.map((period, i) => (
        <PeriodCard key={period.id} period={period} isCurrent={i === currentPeriodIndex} paidStatus={paidStatus} togglePaid={togglePaid} />
      ))}
    </div>
  );
}

// ─── BILLS MANAGER ────────────────────────────────────────────────────────────

interface BillsManagerProps {
  bills: Bill[];
  updateBills: (bills: Bill[]) => void;
}

interface NewBillForm {
  name: string;
  category: BillCategory;
  estimatedAmount: string;
  dayOfMonth: string;
}

function BillsManager({ bills, updateBills }: BillsManagerProps) {
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [newBill, setNewBill] = useState<NewBillForm>({ name: "", category: "other", estimatedAmount: "", dayOfMonth: "" });

  const addBill = (): void => {
    if (!newBill.name || !newBill.estimatedAmount || !newBill.dayOfMonth) return;
    const bill: Bill = {
      id: Date.now().toString(),
      name: newBill.name,
      category: newBill.category,
      estimatedAmount: parseFloat(newBill.estimatedAmount),
      dayOfMonth: parseInt(newBill.dayOfMonth),
      isActive: true,
    };
    updateBills([...bills, bill]);
    setNewBill({ name: "", category: "other", estimatedAmount: "", dayOfMonth: "" });
    setShowAdd(false);
  };

  const toggleBill = (id: string): void => updateBills(bills.map((b) => b.id === id ? { ...b, isActive: !b.isActive } : b));
  const deleteBill = (id: string): void => updateBills(bills.filter((b) => b.id !== id));

  const monthlyTotal = bills.filter((b) => b.isActive).reduce((sum, b) => sum + b.estimatedAmount, 0);

  const grouped = CATEGORIES.reduce<Record<string, Bill[]>>((acc, cat) => {
    const catBills = bills.filter((b) => b.category === cat);
    if (catBills.length > 0) acc[cat] = catBills;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", fontWeight: 300, margin: 0 }}>Bills & Expenses</h2>
          <div style={{ fontSize: "0.75rem", color: BRAND.muted, marginTop: "0.2rem" }}>Monthly total: {formatMoney(monthlyTotal)}</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ padding: "0.55rem 1.1rem", background: BRAND.terracotta, color: BRAND.cream, border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem" }}>
          + Add Bill
        </button>
      </div>

      {showAdd && (
        <div style={{ background: BRAND.espressoMid, borderRadius: 8, padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid rgba(196,98,45,0.3)" }}>
          <div style={{ fontSize: "0.68rem", color: BRAND.gold, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1rem" }}>New Bill</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div><label style={labelSt}>Bill Name</label><input value={newBill.name} onChange={(e) => setNewBill({ ...newBill, name: e.target.value })} placeholder="e.g. Netflix" style={inputSt} /></div>
            <div><label style={labelSt}>Category</label>
              <select value={newBill.category} onChange={(e) => setNewBill({ ...newBill, category: e.target.value as BillCategory })} style={{ ...inputSt, cursor: "pointer" }}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={labelSt}>Amount ($)</label><input type="number" value={newBill.estimatedAmount} onChange={(e) => setNewBill({ ...newBill, estimatedAmount: e.target.value })} placeholder="0.00" style={inputSt} /></div>
            <div><label style={labelSt}>Due Day (1–31)</label><input type="number" value={newBill.dayOfMonth} onChange={(e) => setNewBill({ ...newBill, dayOfMonth: e.target.value })} placeholder="e.g. 15" min={1} max={31} style={inputSt} /></div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={addBill} style={{ flex: 1, padding: "0.65rem", background: BRAND.terracotta, color: BRAND.cream, border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>Save Bill</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "0.65rem 1rem", background: "transparent", color: BRAND.muted, border: "1px solid rgba(245,237,224,0.12)", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([cat, catBills]) => (
        <div key={cat} style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[cat as BillCategory] }} />
            <span style={{ fontSize: "0.68rem", color: CATEGORY_COLORS[cat as BillCategory], textTransform: "uppercase", letterSpacing: "0.15em" }}>{cat}</span>
            <span style={{ fontSize: "0.68rem", color: BRAND.muted }}>· {formatMoney(catBills.filter((b) => b.isActive).reduce((s, b) => s + b.estimatedAmount, 0))}/mo</span>
          </div>
          {catBills.map((bill) => (
            <div key={bill.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.75rem", background: BRAND.espressoMid, borderRadius: 6, marginBottom: "0.4rem", opacity: bill.isActive ? 1 : 0.45 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.87rem", color: BRAND.cream }}>{bill.name}</div>
                <div style={{ fontSize: "0.7rem", color: BRAND.muted }}>Due on the {bill.dayOfMonth}{getOrdinalSuffix(bill.dayOfMonth)} · {formatMoney(bill.estimatedAmount)}/mo</div>
              </div>
              <button onClick={() => toggleBill(bill.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: bill.isActive ? BRAND.green : BRAND.muted, fontSize: "1.1rem" }}>{bill.isActive ? "✅" : "⬜"}</button>
              <button onClick={() => deleteBill(bill.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: BRAND.muted, fontSize: "1rem" }}>🗑️</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── INCOME MANAGER ───────────────────────────────────────────────────────────

interface IncomeManagerProps {
  income: IncomeSource[];
  updateIncome: (income: IncomeSource[]) => void;
}

interface NewIncomeForm {
  name: string;
  amount: string;
  frequency: IncomeFrequency;
  monthlyDay: string;
}

function IncomeManager({ income, updateIncome }: IncomeManagerProps) {
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [newInc, setNewInc] = useState<NewIncomeForm>({ name: "", amount: "", frequency: "biweekly", monthlyDay: "" });

  const add = (): void => {
    if (!newInc.name || !newInc.amount) return;
    const src: IncomeSource = {
      id: Date.now().toString(),
      name: newInc.name,
      amount: parseFloat(newInc.amount),
      frequency: newInc.frequency,
      ...(newInc.frequency === "monthly" ? { monthlyDay: parseInt(newInc.monthlyDay) || 1 } : {}),
    };
    updateIncome([...income, src]);
    setNewInc({ name: "", amount: "", frequency: "biweekly", monthlyDay: "" });
    setShowAdd(false);
  };

  const del = (id: string): void => updateIncome(income.filter((i) => i.id !== id));
  const estMonthly = income.reduce((s, i) => s + (i.frequency === "biweekly" ? i.amount * 2 : i.amount), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", fontWeight: 300, margin: 0 }}>Income Sources</h2>
          <div style={{ fontSize: "0.75rem", color: BRAND.muted, marginTop: "0.2rem" }}>Est. monthly: {formatMoney(estMonthly)}</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: "0.55rem 1.1rem", background: BRAND.green, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.82rem" }}>+ Add Income</button>
      </div>

      {showAdd && (
        <div style={{ background: BRAND.espressoMid, borderRadius: 8, padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid rgba(46,139,87,0.3)" }}>
          <div style={{ fontSize: "0.68rem", color: BRAND.green, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1rem" }}>New Income Source</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div><label style={labelSt}>Source Name</label><input value={newInc.name} onChange={(e) => setNewInc({ ...newInc, name: e.target.value })} placeholder="e.g. My Paycheck" style={inputSt} /></div>
            <div><label style={labelSt}>Net Amount ($)</label><input type="number" value={newInc.amount} onChange={(e) => setNewInc({ ...newInc, amount: e.target.value })} placeholder="0.00" style={inputSt} /></div>
            <div><label style={labelSt}>Frequency</label>
              <select value={newInc.frequency} onChange={(e) => setNewInc({ ...newInc, frequency: e.target.value as IncomeFrequency })} style={{ ...inputSt, cursor: "pointer" }}>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {newInc.frequency === "monthly" && (
              <div><label style={labelSt}>Day of Month</label><input type="number" value={newInc.monthlyDay} onChange={(e) => setNewInc({ ...newInc, monthlyDay: e.target.value })} placeholder="e.g. 28" min={1} max={31} style={inputSt} /></div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={add} style={{ flex: 1, padding: "0.65rem", background: BRAND.green, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "0.65rem 1rem", background: "transparent", color: BRAND.muted, border: "1px solid rgba(245,237,224,0.12)", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
          </div>
        </div>
      )}

      {income.map((src) => (
        <div key={src.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 1.1rem", background: BRAND.espressoMid, borderRadius: 8, marginBottom: "0.75rem", borderLeft: `3px solid ${BRAND.green}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.9rem", color: BRAND.cream, fontWeight: 500 }}>{src.name}</div>
            <div style={{ fontSize: "0.72rem", color: BRAND.muted, marginTop: "0.2rem" }}>
              {formatMoney(src.amount)} · {src.frequency === "biweekly" ? "Every 2 weeks" : `Monthly on the ${src.monthlyDay}${src.monthlyDay ? getOrdinalSuffix(src.monthlyDay) : ""}`}
            </div>
          </div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: "1.2rem", color: BRAND.green }}>{formatMoney(src.amount)}</div>
          <button onClick={() => del(src.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: BRAND.muted, fontSize: "1rem" }}>🗑️</button>
        </div>
      ))}
    </div>
  );
}

// ─── AI ADVISOR ───────────────────────────────────────────────────────────────

interface AIAdvisorProps {
  periods: PayPeriod[];
  income: IncomeSource[];
  settings: BudgetSettings;
}

function AIAdvisor({ periods, income, settings }: AIAdvisorProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (): Promise<void> => {
    setLoading(true); setError(null); setAnalysis(null);

    const summary = periods.map((p) => ({
      period: `Paycheck ${p.periodNumber} (${p.payDate})`,
      income: p.totalIncome,
      bills: p.totalBills,
      closing: p.closingBalance,
      billList: p.bills.map((b) => `${b.name} $${b.estimatedAmount} due ${b.dueDate}`),
    }));

    const prompt = `You are a personal finance advisor for Victoria Booker — a senior software engineer planning to relocate to Hua Hin, Thailand in 12-18 months. She needs to save $30,000 for the move. Her current savings: $${settings.currentSavings}.

Her biweekly pay periods and bills:
${JSON.stringify(summary, null, 2)}

Monthly income sources: ${income.map((i) => `${i.name}: $${i.amount} (${i.frequency})`).join(", ")}

Respond ONLY in JSON (no markdown fences):
{
  "overallHealth": "good|fair|tight",
  "healthSummary": "2-sentence summary",
  "tightPeriods": ["periods under $500 remaining"],
  "rebalanceSuggestions": ["2-3 specific bill rebalancing suggestions"],
  "savingsOpportunity": 1200,
  "monthsToGoal": 18,
  "aiInsights": ["3 specific actionable insights"],
  "encouragement": "one warm encouraging message about Thailand"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", 
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY, 
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      const text: string = data.content?.map((b: { text?: string }) => b.text ?? "").join("") ?? "";
      const clean = text.replace(/```json|```/g, "").trim();
      setAnalysis(JSON.parse(clean) as AIAnalysis);
    } catch {
      setError("Analysis failed. Please try again.");
    }
    setLoading(false);
  };

  const healthColors: Record<BudgetHealth, string> = { good: BRAND.green, fair: BRAND.gold, tight: BRAND.red };

  return (
    <div>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", fontWeight: 300, marginBottom: "0.4rem" }}>AI Budget Advisor</h2>
      <p style={{ color: BRAND.muted, fontSize: "0.82rem", marginBottom: "1.5rem" }}>Get a real analysis with specific suggestions for your Thailand savings goal.</p>

      <button onClick={analyze} disabled={loading}
        style={{ width: "100%", padding: "0.9rem", background: loading ? "rgba(245,237,224,0.08)" : BRAND.terracotta, color: BRAND.cream, border: "none", borderRadius: 8, cursor: loading ? "default" : "pointer", fontSize: "0.9rem", fontWeight: 500, marginBottom: "1.5rem" }}>
        {loading ? "🤖 Analyzing your budget..." : "🤖 Analyze My Budget"}
      </button>

      {error && <div style={{ color: BRAND.red, fontSize: "0.83rem", marginBottom: "1rem" }}>{error}</div>}

      {analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ background: BRAND.espressoMid, borderRadius: 8, padding: "1.25rem", borderTop: `3px solid ${healthColors[analysis.overallHealth]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.68rem", color: BRAND.gold, textTransform: "uppercase", letterSpacing: "0.15em" }}>Budget Health</div>
              <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.75rem", borderRadius: 12, background: `${healthColors[analysis.overallHealth]}20`, color: healthColors[analysis.overallHealth], textTransform: "capitalize" }}>{analysis.overallHealth}</span>
            </div>
            <p style={{ fontSize: "0.87rem", color: BRAND.cream, lineHeight: 1.65, margin: 0 }}>{analysis.healthSummary}</p>
          </div>

          <div style={{ background: BRAND.espressoMid, borderRadius: 8, padding: "1.25rem", borderTop: `3px solid ${BRAND.gold}` }}>
            <div style={{ fontSize: "0.68rem", color: BRAND.gold, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>🇹🇭 Thailand Fund</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <MiniStat label="Save/Month"    value={formatMoney(analysis.savingsOpportunity)} color={BRAND.green} />
              <MiniStat label="Months to Goal" value={analysis.monthsToGoal}                    color={BRAND.gold} />
              <MiniStat label="Saved"          value={formatMoney(settings.currentSavings)}     color={BRAND.terracotta} />
            </div>
            <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 4, height: 6, overflow: "hidden", marginBottom: "0.75rem" }}>
              <div style={{ height: "100%", background: BRAND.gold, width: `${Math.min(100, (settings.currentSavings / settings.savingsGoal) * 100)}%`, transition: "width 0.5s" }} />
            </div>
            <p style={{ fontSize: "0.82rem", color: BRAND.cream, fontStyle: "italic", margin: 0 }}>{analysis.encouragement}</p>
          </div>

          {analysis.aiInsights.length > 0 && (
            <div style={{ background: BRAND.espressoMid, borderRadius: 8, padding: "1.25rem" }}>
              <div style={{ fontSize: "0.68rem", color: BRAND.terracotta, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>💡 Insights</div>
              {analysis.aiInsights.map((insight, i) => (
                <div key={i} style={{ fontSize: "0.85rem", color: BRAND.cream, lineHeight: 1.6, paddingLeft: "1rem", borderLeft: "2px solid rgba(196,98,45,0.4)", marginBottom: i < analysis.aiInsights.length - 1 ? "0.75rem" : 0 }}>{insight}</div>
              ))}
            </div>
          )}

          {analysis.rebalanceSuggestions.length > 0 && (
            <div style={{ background: BRAND.espressoMid, borderRadius: 8, padding: "1.25rem" }}>
              <div style={{ fontSize: "0.68rem", color: BRAND.green, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>⚖️ Rebalance Suggestions</div>
              {analysis.rebalanceSuggestions.map((s, i) => (
                <div key={i} style={{ fontSize: "0.85rem", color: BRAND.cream, lineHeight: 1.6, paddingLeft: "1rem", borderLeft: "2px solid rgba(46,139,87,0.4)", marginBottom: i < analysis.rebalanceSuggestions.length - 1 ? "0.75rem" : 0 }}>{s}</div>
              ))}
            </div>
          )}

          {analysis.tightPeriods.length > 0 && (
            <div style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: 8, padding: "1.25rem" }}>
              <div style={{ fontSize: "0.68rem", color: BRAND.red, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "0.75rem" }}>⚠️ Tight Periods</div>
              {analysis.tightPeriods.map((p, i) => (
                <div key={i} style={{ fontSize: "0.85rem", color: BRAND.cream, lineHeight: 1.6, marginBottom: "0.4rem" }}>· {p}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

interface SettingsProps {
  settings: BudgetSettings;
  updateSettings: (s: BudgetSettings) => void;
}

function Settings({ settings, updateSettings }: SettingsProps) {
  const [form, setForm] = useState<BudgetSettings>(settings);
  const save = (): void => updateSettings(form);

  return (
    <div>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.5rem", fontWeight: 300, marginBottom: "1.5rem" }}>Settings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", background: BRAND.espressoMid, borderRadius: 8, padding: "1.5rem" }}>
        <div>
          <label style={labelSt}>First Pay Date</label>
          <input type="date" value={form.firstPayDate} onChange={(e) => setForm({ ...form, firstPayDate: e.target.value })} style={inputSt} />
          <div style={{ fontSize: "0.7rem", color: BRAND.muted, marginTop: "0.3rem" }}>Biweekly periods are generated forward from this date</div>
        </div>
        <div>
          <label style={labelSt}>Current Period Balance ($)</label>
          <input type="number" value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: parseFloat(e.target.value) || 0 })} style={inputSt} />
          <div style={{ fontSize: "0.7rem", color: BRAND.muted, marginTop: "0.3rem" }}>This value is used as the opening balance for your current pay period.</div>
        </div>
        <div><label style={labelSt}>Savings Goal Name</label><input value={form.savingsGoalName} onChange={(e) => setForm({ ...form, savingsGoalName: e.target.value })} style={inputSt} /></div>
        <div><label style={labelSt}>Savings Goal Amount ($)</label><input type="number" value={form.savingsGoal} onChange={(e) => setForm({ ...form, savingsGoal: parseFloat(e.target.value) || 0 })} style={inputSt} /></div>
        <div><label style={labelSt}>Current Savings ($)</label><input type="number" value={form.currentSavings} onChange={(e) => setForm({ ...form, currentSavings: parseFloat(e.target.value) || 0 })} placeholder="0" style={inputSt} /></div>
        <button onClick={save} style={{ padding: "0.8rem", background: BRAND.terracotta, color: BRAND.cream, border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.9rem", fontWeight: 500 }}>Save Settings</button>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function PaycheckBudget() {
  const [tab, setTab]             = useState<TabId>("dashboard");
  const [bills, setBills]         = useState<Bill[]>(DEFAULT_BILLS);
  const [income, setIncome]       = useState<IncomeSource[]>(DEFAULT_INCOME);
  const [settings, setSettings]   = useState<BudgetSettings>(DEFAULT_SETTINGS);
  const [paidStatus, setPaidStatus] = useState<PaidStatus>({});
  const [loading, setLoading]     = useState<boolean>(true);

  useEffect(() => {
    (async () => {
      try {
        const [b, inc, s, p] = await Promise.all([
          storage.get("pb:bills").catch(() => null),
          storage.get("pb:income").catch(() => null),
          storage.get("pb:settings").catch(() => null),
          storage.get("pb:paid").catch(() => null),
        ]);
        if (b?.value)   setBills(JSON.parse(b.value) as Bill[]);
        if (inc?.value) setIncome(JSON.parse(inc.value) as IncomeSource[]);
        if (s?.value)   setSettings(JSON.parse(s.value) as BudgetSettings);
        if (p?.value)   setPaidStatus(JSON.parse(p.value) as PaidStatus);
      } catch { /* first visit — use defaults */ }
      setLoading(false);
    })();
  }, []);

  const persist = async (key: string, data: unknown): Promise<void> => {
    try { await storage.set(key, JSON.stringify(data)); } catch { /* silent */ }
  };

  const updateBills    = (u: Bill[])         => { setBills(u);    persist("pb:bills",    u); };
  const updateIncome   = (u: IncomeSource[]) => { setIncome(u);   persist("pb:income",   u); };
  const updateSettings = (u: BudgetSettings) => { setSettings(u); persist("pb:settings", u); };

  const togglePaid = (key: string): void => {
    const updated = { ...paidStatus, [key]: !paidStatus[key] };
    setPaidStatus(updated);
    persist("pb:paid", updated);
  };

  const periods: PayPeriod[] = useMemo(() => {
    const raw = generatePayPeriods(settings, 4);
    let balance = settings.currentBalance;
    return raw.map((period) => {
      const periodBills   = getBillsForPeriod(bills, period);
      const periodIncome  = getIncomeForPeriod(income, period);
      const totalIncome   = periodIncome.reduce((s, src) => s + src.amount, 0);
      const totalBills    = periodBills.reduce((s, b)   => s + b.estimatedAmount, 0);
      const opening       = balance;
      const closing       = opening + totalIncome - totalBills;
      balance             = closing;
      return { ...period, incomeSources: periodIncome, bills: periodBills, openingBalance: opening, totalIncome, totalBills, closingBalance: closing };
    });
  }, [bills, income, settings]);

  const currentPeriodIndex = useMemo(() => {
    const idx = getCurrentPeriodIndex(periods, new Date());
    return idx === -1 ? 0 : idx;
  }, [periods]);

  const TABS: TabItem[] = [
    { id: "dashboard", label: "Paychecks", emoji: "💰" },
    { id: "bills",     label: "Bills",     emoji: "📋" },
    { id: "income",    label: "Income",    emoji: "💵" },
    { id: "ai",        label: "AI Advisor",emoji: "🤖" },
    { id: "settings",  label: "Settings",  emoji: "⚙️" },
  ];

  if (loading) return (
    <div style={{ background: BRAND.espresso, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: BRAND.gold, fontFamily: "Georgia, serif", fontSize: "1.3rem" }}>Loading your budget...</div>
    </div>
  );

  return (
    <div style={{ background: BRAND.espresso, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: BRAND.darkBrown }}>
      <header style={{ background: BRAND.espressoMid, padding: "1rem 1.25rem", borderBottom: "1px solid rgba(201,164,68,0.2)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "1.1rem" }}>Booker Budget</div>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: BRAND.gold }}>Pay Period Tracker</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.65rem", color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>{settings.savingsGoalName}</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "1.1rem", color: BRAND.gold }}>{formatMoney(settings.currentSavings)} / {formatMoney(settings.savingsGoal)}</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 700, margin: "1.5rem auto 6rem", padding: "1.75rem 1.5rem", background: BRAND.cream, borderRadius: 20, boxShadow: "0 30px 80px rgba(0,0,0,0.06)", border: "1px solid rgba(50,67,55,0.06)", color: BRAND.darkBrown }}>
        {tab === "dashboard" && <Dashboard periods={periods} currentPeriodIndex={currentPeriodIndex} settings={settings} updateSettings={updateSettings} paidStatus={paidStatus} togglePaid={togglePaid} />}
        {tab === "bills"     && <BillsManager bills={bills} updateBills={updateBills} />}
        {tab === "income"    && <IncomeManager income={income} updateIncome={updateIncome} />}
        {tab === "ai"        && <AIAdvisor periods={periods} income={income} settings={settings} />}
        {tab === "settings"  && <Settings settings={settings} updateSettings={updateSettings} />}
      </main>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: BRAND.espressoMid, borderTop: "1px solid rgba(201,164,68,0.2)", display: "flex", justifyContent: "space-around", padding: "0.6rem 0" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem", padding: "0.25rem 0.5rem", color: tab === t.id ? BRAND.terracotta : BRAND.muted, transition: "color 0.2s" }}>
            <span style={{ fontSize: "1.2rem" }}>{t.emoji}</span>
            <span style={{ fontSize: "0.6rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
