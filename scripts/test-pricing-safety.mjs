import assert from "node:assert/strict";

function parseMoney(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function parsePositiveMoney(value) {
  const n = parseMoney(value);
  if (n == null || n <= 0) return null;
  return n;
}

const MINOR_SCALE = 10_000;

function toMinor(value) {
  return Math.round(Number((Number(value) * MINOR_SCALE).toFixed(8)));
}

function minorToUsd(minor) {
  return minor / MINOR_SCALE;
}

function toCents(value) {
  return Math.round(Number((Number(value) * 100).toFixed(8)));
}

function centsToUsd(cents) {
  return cents / 100;
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return centsToUsd(toCents(n));
}

function applyPriceRounding(value, rounding = "round2") {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (rounding === "round") return Math.round(n);
  if (rounding === "ceil") return Math.ceil(n);
  return round2(n);
}

function computeRetailPrice(providerPrice, marginPercent, rounding = "round2") {
  const cost = Number(providerPrice);
  const margin = Number(marginPercent);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const pct = Number.isFinite(margin) ? margin : 0;
  return applyPriceRounding(cost * (1 + pct / 100), rounding);
}

function computeOrderCharge(pricePer1000, quantity) {
  const price = Number(pricePer1000);
  const qty = Number(quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) return 0;
  const cents = toCents((price * qty) / 1000);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return centsToUsd(cents);
}

function computeProviderCost(pricePer1000, quantity) {
  const price = Number(pricePer1000);
  const qty = Number(quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) return null;
  const minor = toMinor((price * qty) / 1000);
  if (!Number.isFinite(minor) || minor <= 0) return null;
  return minorToUsd(minor);
}

const SELLING_BELOW_COST_MESSAGE =
  "This service is temporarily unavailable because its current provider cost is higher than the selling price. Please try another service.";
const PROVIDER_COST_UNKNOWN_MESSAGE =
  "This service is temporarily unavailable because its current provider cost could not be verified. Please try another service.";

function evaluatePricingSafety(sellingPrice, providerCost) {
  if (providerCost == null) {
    return { ok: false, reason: "unavailable", message: PROVIDER_COST_UNKNOWN_MESSAGE };
  }
  const sellMinor = toMinor(sellingPrice);
  const costMinor = toMinor(providerCost);
  if (!Number.isFinite(sellMinor) || !Number.isFinite(costMinor) || costMinor <= 0) {
    return { ok: false, reason: "unavailable", message: PROVIDER_COST_UNKNOWN_MESSAGE };
  }
  if (sellMinor < costMinor) {
    return { ok: false, reason: "underpriced", message: SELLING_BELOW_COST_MESSAGE };
  }
  return { ok: true, providerCost: minorToUsd(costMinor) };
}

function computeOrderProfit(order, service) {
  const customerPrice = Number(order.price);
  if (!Number.isFinite(customerPrice) || customerPrice < 0) {
    return { customerPrice: 0, providerCost: null, profit: null, profitPercent: null };
  }
  const recordedCost = parsePositiveMoney(order.charge);
  const providerPrice = parsePositiveMoney(service?.provider_price);
  let providerCost = null;
  if (recordedCost != null) {
    providerCost = recordedCost;
  } else if (providerPrice != null) {
    providerCost = computeProviderCost(providerPrice, order.quantity);
  }
  if (providerCost == null) {
    return { customerPrice, providerCost: null, profit: null, profitPercent: null };
  }
  const profitMinor = toMinor(customerPrice) - toMinor(providerCost);
  const profit = minorToUsd(profitMinor);
  const sellMinor = toMinor(customerPrice);
  const profitPercent = sellMinor > 0 ? round2((profitMinor / sellMinor) * 100) : null;
  return { customerPrice, providerCost, profit, profitPercent };
}

const qty = 300;
const userPrice = computeOrderCharge(0.8, qty);
const providerCost = computeProviderCost(1.76, qty);
assert.equal(userPrice, 0.24);
assert.equal(providerCost, 0.528);

const loss = evaluatePricingSafety(userPrice, providerCost);
assert.equal(loss.ok, false);
assert.equal(loss.reason, "underpriced");
assert.equal(loss.message, SELLING_BELOW_COST_MESSAGE);

const profitSell = computeOrderCharge(2.2, qty);
assert.equal(profitSell, 0.66);
assert.ok(profitSell > providerCost);
const ok = evaluatePricingSafety(profitSell, providerCost);
assert.equal(ok.ok, true);
assert.equal(ok.providerCost, 0.528);

const unknownNull = evaluatePricingSafety(userPrice, null);
assert.equal(unknownNull.ok, false);
assert.equal(unknownNull.reason, "unavailable");

const unknownZero = evaluatePricingSafety(userPrice, 0);
assert.equal(unknownZero.ok, false);
assert.equal(unknownZero.reason, "unavailable");

const fakeCharge = computeOrderProfit({ price: 0.24, quantity: qty, charge: 0 }, { provider_price: null });
assert.equal(fakeCharge.providerCost, null);
assert.equal(fakeCharge.profit, null);
assert.equal(fakeCharge.profitPercent, null);

const recordedLoss = computeOrderProfit({ price: 0.24, quantity: qty, charge: 0.528 }, { provider_price: 1.76 });
assert.equal(recordedLoss.providerCost, 0.528);
assert.equal(recordedLoss.profit, -0.288);
assert.equal(recordedLoss.profitPercent, -120);

const recordedProfit = computeOrderProfit({ price: 0.66, quantity: qty, charge: 0.528 }, { provider_price: 1.76 });
assert.equal(recordedProfit.providerCost, 0.528);
assert.equal(recordedProfit.profit, 0.132);
assert.equal(recordedProfit.profitPercent, 20);

const fallbackFromService = computeOrderProfit({ price: 0.24, quantity: qty, charge: 0 }, { provider_price: 1.76 });
assert.equal(fallbackFromService.providerCost, 0.528);
assert.equal(fallbackFromService.profit, -0.288);

const service6005Provider = 1.17;
const service6005Sell = computeRetailPrice(service6005Provider, 15, "round2");
assert.equal(service6005Sell, 1.35);

const loss6005 = evaluatePricingSafety(computeOrderCharge(0.49, 1000), computeProviderCost(1.17, 1000));
assert.equal(loss6005.ok, false);
assert.equal(loss6005.reason, "underpriced");

const profit6005 = evaluatePricingSafety(computeOrderCharge(1.35, 1000), computeProviderCost(1.17, 1000));
assert.equal(profit6005.ok, true);
assert.equal(profit6005.providerCost, 1.17);

assert.equal(evaluatePricingSafety(1.35, null).ok, false);
assert.equal(evaluatePricingSafety(1.35, 0).ok, false);

const recorded6005 = computeOrderProfit({ price: 1.35, quantity: 1000, charge: 1.17 }, { provider_price: 1.17 });
assert.equal(recorded6005.providerCost, 1.17);
assert.equal(recorded6005.profit, 0.18);
assert.equal(recorded6005.profitPercent, 13.33);

console.log("pricing safety tests passed");
