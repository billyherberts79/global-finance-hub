import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import ExcelJS from "exceljs";

import type { HistoryCandle, QuoteSnapshot } from "../api/finance.functions";
import { fmtBRL, fmtCurrency, fmtDate, fmtNumber, fmtPercent } from "./format";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportHistoryCSV(
  name: string,
  symbol: string,
  currency: string,
  candles: HistoryCandle[],
  fxToBRL: number,
) {
  const header = ["Data", "Abertura", "Maxima", "Minima", "Fechamento", `Fechamento_BRL`, "Volume"];
  const rows = candles.map((c) => [
    new Date(c.t).toLocaleDateString("pt-BR"),
    c.open ?? "",
    c.high ?? "",
    c.low ?? "",
    c.close,
    (c.close * fxToBRL).toFixed(4),
    c.volume ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
  // BOM for Excel pt-BR
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  download(blob, `historico-${symbol.replace(/[^a-z0-9]/gi, "_")}.csv`);
}

export function exportQuotesCSV(quotes: QuoteSnapshot[]) {
  const header = ["Categoria", "Ativo", "Simbolo", "Moeda", "Preco", "Preco_BRL", "Variacao_24h_%", "Max_24h", "Min_24h", "Atualizado"];
  const rows = quotes.map((q) => [
    q.category, q.name, q.symbol, q.currency,
    q.price ?? "", q.priceBRL ?? "", q.changePercent ?? "",
    q.high24h ?? "", q.low24h ?? "",
    new Date(q.updatedAt).toLocaleString("pt-BR"),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  download(blob, `cotacoes-${Date.now()}.csv`);
}

export async function exportAssetPDF(
  name: string,
  symbol: string,
  currency: string,
  candles: HistoryCandle[],
  fxToBRL: number,
) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const closes = candles.map((c) => c.close);
  const max = Math.max(...closes);
  const min = Math.min(...closes);
  const first = candles[0];
  const last = candles[candles.length - 1];
  const variation = first ? ((last.close - first.close) / first.close) * 100 : 0;

  const drawText = (text: string, x: number, y: number, size = 10, useBold = false) => {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color: rgb(0.1, 0.1, 0.12) });
  };

  let y = 800;
  drawText("Dashboard Financeiro Global", 40, y, 16, true);
  y -= 24;
  drawText(`${name}  (${symbol})`, 40, y, 13, true);
  y -= 18;
  drawText(`Período: ${fmtDate(first.t)} — ${fmtDate(last.t)}`, 40, y, 10);
  y -= 14;
  drawText(`Moeda original: ${currency}   |   Taxa BRL: ${fmtNumber(fxToBRL, 4)}`, 40, y, 10);

  y -= 32;
  drawText("Estatísticas do período", 40, y, 12, true);
  y -= 18;
  const rows: [string, string][] = [
    ["Abertura", `${fmtCurrency(first.open ?? first.close, currency)}   (${fmtBRL((first.open ?? first.close) * fxToBRL)})`],
    ["Fechamento", `${fmtCurrency(last.close, currency)}   (${fmtBRL(last.close * fxToBRL)})`],
    ["Máxima", `${fmtCurrency(max, currency)}   (${fmtBRL(max * fxToBRL)})`],
    ["Mínima", `${fmtCurrency(min, currency)}   (${fmtBRL(min * fxToBRL)})`],
    ["Variação %", fmtPercent(variation)],
    ["Candles", String(candles.length)],
  ];
  for (const [k, v] of rows) {
    drawText(k, 40, y, 10, true);
    drawText(v, 200, y, 10);
    y -= 16;
  }

  // Mini chart (close line)
  y -= 20;
  drawText("Histórico (close)", 40, y, 12, true);
  y -= 10;
  const chartX = 40, chartY = y - 200, chartW = 515, chartH = 200;
  page.drawRectangle({ x: chartX, y: chartY, width: chartW, height: chartH, borderColor: rgb(0.7, 0.7, 0.75), borderWidth: 0.5 });
  const range = max - min || 1;
  for (let i = 1; i < closes.length; i++) {
    const x1 = chartX + ((i - 1) / (closes.length - 1)) * chartW;
    const x2 = chartX + (i / (closes.length - 1)) * chartW;
    const y1 = chartY + ((closes[i - 1] - min) / range) * chartH;
    const y2 = chartY + ((closes[i] - min) / range) * chartH;
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: rgb(0.23, 0.51, 0.96), thickness: 0.8 });
  }

  y = chartY - 30;
  drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, y, 9);

  const bytes = await pdf.save();
  download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `relatorio-${symbol.replace(/[^a-z0-9]/gi, "_")}.pdf`);
}

export async function exportQuotesXLSX(quotes: QuoteSnapshot[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard Financeiro Global";
  wb.created = new Date();

  const groups: Record<string, QuoteSnapshot[]> = { cripto: [], moedas: [], commodities: [], indices: [] };
  for (const q of quotes) groups[q.category]?.push(q);

  const labels: Record<string, string> = {
    cripto: "Criptomoedas",
    moedas: "Moedas",
    commodities: "Commodities",
    indices: "Índices",
  };

  for (const [cat, list] of Object.entries(groups)) {
    if (!list.length) continue;
    const ws = wb.addWorksheet(labels[cat]);
    ws.columns = [
      { header: "Ativo", key: "name", width: 24 },
      { header: "Símbolo", key: "symbol", width: 14 },
      { header: "Moeda", key: "currency", width: 8 },
      { header: "Preço (original)", key: "price", width: 16, style: { numFmt: "#,##0.0000" } },
      { header: "Preço (BRL)", key: "priceBRL", width: 16, style: { numFmt: '"R$" #,##0.00' } },
      { header: "Variação 24h %", key: "change", width: 14, style: { numFmt: '0.00"%"' } },
      { header: "Máx 24h", key: "high", width: 14, style: { numFmt: "#,##0.0000" } },
      { header: "Mín 24h", key: "low", width: 14, style: { numFmt: "#,##0.0000" } },
      { header: "Atualizado", key: "updated", width: 22 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const q of list) {
      ws.addRow({
        name: q.name, symbol: q.symbol, currency: q.currency,
        price: q.price, priceBRL: q.priceBRL, change: q.changePercent,
        high: q.high24h, low: q.low24h,
        updated: new Date(q.updatedAt).toLocaleString("pt-BR"),
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `dashboard-financeiro-${Date.now()}.xlsx`);
}

export async function exportHistoryXLSX(name: string, symbol: string, currency: string, candles: HistoryCandle[], fxToBRL: number) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name.slice(0, 28));
  ws.columns = [
    { header: "Data", key: "date", width: 14 },
    { header: "Abertura", key: "open", width: 14, style: { numFmt: "#,##0.0000" } },
    { header: "Máxima", key: "high", width: 14, style: { numFmt: "#,##0.0000" } },
    { header: "Mínima", key: "low", width: 14, style: { numFmt: "#,##0.0000" } },
    { header: "Fechamento", key: "close", width: 14, style: { numFmt: "#,##0.0000" } },
    { header: `Fechamento BRL`, key: "closeBRL", width: 16, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Volume", key: "volume", width: 16, style: { numFmt: "#,##0" } },
  ];
  ws.getRow(1).font = { bold: true };
  for (const c of candles) {
    ws.addRow({
      date: new Date(c.t).toLocaleDateString("pt-BR"),
      open: c.open, high: c.high, low: c.low, close: c.close,
      closeBRL: c.close * fxToBRL, volume: c.volume,
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  download(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `historico-${symbol.replace(/[^a-z0-9]/gi, "_")}.xlsx`,
  );
}