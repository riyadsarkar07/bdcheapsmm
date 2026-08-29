import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { Order, OrderStatus } from "@/lib/types/database";

const PAGE_WIDTH = 595.28; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Brand palette (matches the app's violet-600 theme color).
const ACCENT: RGB = rgb(0x7c / 255, 0x3a / 255, 0xed / 255);
const TEXT_DARK: RGB = rgb(0x17 / 255, 0x1a / 255, 0x21 / 255);
const TEXT_MUTED: RGB = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const BORDER: RGB = rgb(0xe5 / 255, 0xe7 / 255, 0xeb / 255);
const LIGHT_BG: RGB = rgb(0xf9 / 255, 0xfa / 255, 0xfb / 255);

function formatUsd(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (Number.isNaN(value)) return "$0.00";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status: OrderStatus | string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso: string | null | undefined, timezone: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("en-US", {
      timeZone: timezone ?? undefined,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}

/** Word-wrap text to fit maxWidth, breaking over-long words (e.g. URLs). */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    // Break the single word if it alone overflows (common for long links).
    let chunk = "";
    for (const char of word) {
      if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: RGB
): number {
  const lines = wrapText(text, font, size, maxWidth);
  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineHeight;
  }
  return y;
}

interface InvoiceInput {
  order: Pick<
    Order,
    "order_number" | "link" | "quantity" | "price" | "status" | "provider_order_id" | "created_at"
  >;
  serviceName: string | null;
  profile: { full_name: string | null; email: string | null };
  panel: { name: string; tagline: string | null; logo: string | null };
  timezone?: string | null;
}

/**
 * Build a single-page A4 PDF invoice for an order. Pure server-side generation
 * with pdf-lib; never reads or mutates order data.
 */
export async function generateOrderInvoicePdf(input: InvoiceInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedStandardFont(StandardFonts.Helvetica);
  const bold = await doc.embedStandardFont(StandardFonts.HelveticaBold);

  const logo = await loadLogo(doc, input.panel.logo);

  // ------------------------------------------------------------
  // Header
  // ------------------------------------------------------------
  let headerY = PAGE_HEIGHT - MARGIN;

  if (logo) {
    const ratio = logo.width / logo.height;
    const logoHeight = Math.min(44, 110 / ratio);
    const logoWidth = ratio * logoHeight;
    page.drawImage(logo, { x: MARGIN, y: headerY - logoHeight, width: logoWidth, height: logoHeight });
    headerY -= logoHeight;
  }

  const brandX = logo ? MARGIN + 70 : MARGIN;
  const brandNameY = logo ? headerY - 4 : headerY - 22;
  page.drawText(input.panel.name || "SMM Panel", { x: brandX, y: brandNameY, size: 20, font: bold, color: TEXT_DARK });
  if (input.panel.tagline) {
    page.drawText(input.panel.tagline, { x: brandX, y: brandNameY - 16, size: 9, font, color: TEXT_MUTED });
  }

  const titleWidth = 96;
  page.drawText("INVOICE", { x: PAGE_WIDTH - MARGIN - titleWidth, y: headerY - 26, size: 26, font: bold, color: ACCENT });
  const invoiceNum = `Invoice #${input.order.order_number}`;
  page.drawText(invoiceNum, {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(invoiceNum, 10),
    y: headerY - 40,
    size: 10,
    font,
    color: TEXT_MUTED,
  });

  // Accent divider under the header
  page.drawRectangle({
    x: MARGIN,
    y: headerY - 62,
    width: CONTENT_WIDTH,
    height: 2.5,
    color: ACCENT,
  });

  // ------------------------------------------------------------
  // Bill To + order metadata
  // ------------------------------------------------------------
  const metaTop = headerY - 92;
  page.drawText("BILLED TO", { x: MARGIN, y: metaTop, size: 8, font: bold, color: TEXT_MUTED });
  const billToLines: string[] = [];
  if (input.profile.full_name) billToLines.push(input.profile.full_name);
  if (input.profile.email) billToLines.push(input.profile.email);
  if (billToLines.length === 0) billToLines.push("—");
  let billY = metaTop - 16;
  billToLines.forEach((line, i) => {
    page.drawText(line, {
      x: MARGIN,
      y: billY,
      size: i === 0 ? 12 : 10,
      font: i === 0 ? bold : font,
      color: i === 0 ? TEXT_DARK : TEXT_MUTED,
    });
    billY -= 16;
  });

  const metaRows: { label: string; value: string }[] = [
    { label: "Order Date", value: formatDateTime(input.order.created_at, input.timezone ?? null) },
    { label: "Status", value: statusLabel(input.order.status) },
    { label: "Provider Order ID", value: input.order.provider_order_id ?? "N/A" },
  ];
  let metaX = PAGE_WIDTH - MARGIN - 170;
  let metaY = metaTop;
  for (const row of metaRows) {
    page.drawText(row.label, { x: metaX, y: metaY, size: 9, font, color: TEXT_MUTED });
    page.drawText(row.value, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(row.value, 9),
      y: metaY,
      size: 9,
      font: bold,
      color: TEXT_DARK,
    });
    metaY -= 16;
  }

  // ------------------------------------------------------------
  // Order details table
  // ------------------------------------------------------------
  const tableTop = Math.max(metaTop, billY) - 40;
  const colQtyX = PAGE_WIDTH - MARGIN - 150; // Quantity column right edge offset
  const colAmountX = PAGE_WIDTH - MARGIN - 75; // Amount column right edge offset
  const headerBgHeight = 22;

  page.drawRectangle({ x: MARGIN, y: tableTop - headerBgHeight, width: CONTENT_WIDTH, height: headerBgHeight, color: LIGHT_BG });
  page.drawLine({ start: { x: MARGIN, y: tableTop }, end: { x: PAGE_WIDTH - MARGIN, y: tableTop }, thickness: 1, color: BORDER });
  page.drawText("DESCRIPTION", { x: MARGIN + 12, y: tableTop - 15, size: 9, font: bold, color: TEXT_MUTED });
  const qtyLabel = "QUANTITY";
  page.drawText(qtyLabel, { x: colQtyX - font.widthOfTextAtSize(qtyLabel, 9), y: tableTop - 15, size: 9, font: bold, color: TEXT_MUTED });
  const amountLabel = "AMOUNT";
  page.drawText(amountLabel, { x: colAmountX - font.widthOfTextAtSize(amountLabel, 9), y: tableTop - 15, size: 9, font: bold, color: TEXT_MUTED });

  // Row content (service name + wrapped target URL)
  const descWidth = colQtyX - MARGIN - 24;
  page.drawText(input.serviceName || "—", { x: MARGIN + 12, y: tableTop - 40, size: 10, font: bold, color: TEXT_DARK });
  const linkBottom = drawWrapped(
    page,
    input.order.link,
    font,
    9,
    MARGIN + 12,
    tableTop - 55,
    descWidth,
    13,
    TEXT_MUTED
  );

  const qtyValue = input.order.quantity.toLocaleString("en-US");
  page.drawText(qtyValue, { x: colQtyX - font.widthOfTextAtSize(qtyValue, 10), y: tableTop - 40, size: 10, font, color: TEXT_DARK });
  const amountValue = formatUsd(input.order.price);
  page.drawText(amountValue, { x: colAmountX - font.widthOfTextAtSize(amountValue, 10), y: tableTop - 40, size: 10, font: bold, color: TEXT_DARK });

  // Bottom border of the table + totals (border tracks the wrapped link bottom)
  const tableBottom = Math.min(linkBottom, tableTop - 55) - 10;
  page.drawLine({ start: { x: MARGIN, y: tableBottom }, end: { x: PAGE_WIDTH - MARGIN, y: tableBottom }, thickness: 1, color: BORDER });
  const totalLabel = "Amount Paid";
  page.drawText(totalLabel, { x: colQtyX - font.widthOfTextAtSize(totalLabel, 11), y: tableBottom - 20, size: 11, font: bold, color: TEXT_DARK });
  const totalValue = formatUsd(input.order.price);
  page.drawText(totalValue, { x: colAmountX - font.widthOfTextAtSize(totalValue, 12), y: tableBottom - 21, size: 12, font: bold, color: ACCENT });

  // ------------------------------------------------------------
  // Footer
  // ------------------------------------------------------------
  page.drawLine({ start: { x: MARGIN, y: 96 }, end: { x: PAGE_WIDTH - MARGIN, y: 96 }, thickness: 1, color: BORDER });
  page.drawText("Thank you for your business!", { x: MARGIN, y: 74, size: 10, font: bold, color: TEXT_DARK });
  const generated = `Generated on ${formatDateTime(new Date().toISOString(), input.timezone ?? null)} by ${input.panel.name || "SMM Panel"}`;
  page.drawText(generated, { x: MARGIN, y: 56, size: 8, font, color: TEXT_MUTED });

  return doc.save();
}

async function loadLogo(doc: PDFDocument, logoUrl: string | null): Promise<PDFImage | null> {
  if (!logoUrl) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(logoUrl, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (isPng) return doc.embedPng(buf);
    if (isJpeg) return doc.embedJpg(buf);
    return null;
  } catch {
    return null;
  }
}
