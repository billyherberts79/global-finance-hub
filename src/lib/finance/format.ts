const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const USD = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const EUR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const GBP = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "GBP", maximumFractionDigits: 2 });
const JPY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const HKD = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "HKD", maximumFractionDigits: 2 });
const CNY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "CNY", maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const PCT = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function fmtCurrency(value: number | null | undefined, currency: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  switch (currency) {
    case "BRL": return BRL.format(value);
    case "USD": return USD.format(value);
    case "EUR": return EUR.format(value);
    case "GBP": return GBP.format(value);
    case "JPY": return JPY.format(value);
    case "HKD": return HKD.format(value);
    case "CNY": return CNY.format(value);
    default: return NUM.format(value);
  }
}

export function fmtBRL(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return BRL.format(value);
}

export function fmtNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function fmtPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return PCT.format(value / 100);
}

export function fmtDate(ts: number | string | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleDateString("pt-BR");
}

export function fmtDateTime(ts: number | string | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString("pt-BR");
}