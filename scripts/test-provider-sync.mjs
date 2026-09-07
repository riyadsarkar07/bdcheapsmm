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

function parseProviderRate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return parsePositiveMoney(value);
  const normalized = String(value)
    .trim()
    .replace(/[$,]/g, "")
    .replace(/\s+/g, "");
  return parsePositiveMoney(normalized);
}

function normalizeProviderServiceId(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Number.isInteger(value) ? String(value) : String(Math.trunc(value));
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+(\.0+)?$/.test(text)) return String(parseInt(text, 10));
  return text;
}

function unwrapProviderCatalog(data, depth = 0) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object" || depth > 3) return [];
  for (const key of ["services", "data", "result", "items", "list"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  for (const key of ["services", "data", "result", "items", "list"]) {
    if (data[key] && typeof data[key] === "object") {
      const deeper = unwrapProviderCatalog(data[key], depth + 1);
      if (deeper.length > 0) return deeper;
    }
  }
  return [];
}

function firstValue(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function normalizeProviderServiceItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const serviceId = normalizeProviderServiceId(
    firstValue(raw, ["service", "service_id", "serviceId", "id", "ID"])
  );
  const rate = parseProviderRate(firstValue(raw, ["rate", "price", "cost", "provider_price", "Rate"]));
  if (!serviceId || rate == null) return null;
  return { service_id: serviceId, rate };
}

function normalizeProviderCatalog(data) {
  return unwrapProviderCatalog(data).map(normalizeProviderServiceItem).filter(Boolean);
}

function toCents(value) {
  return Math.round(Number((Number(value) * 100).toFixed(8)));
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return toCents(n) / 100;
}

function computeRetailPrice(providerPrice, marginPercent, rounding = "round2") {
  const cost = Number(providerPrice);
  const margin = Number(marginPercent);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const pct = Number.isFinite(margin) ? margin : 0;
  const raw = cost * (1 + pct / 100);
  if (rounding === "round") return Math.round(raw);
  if (rounding === "ceil") return Math.ceil(raw);
  return round2(raw);
}

function buildSyncPayload(items, defaultMargin, rounding) {
  const payload = [];
  for (const item of items) {
    const rate = parseProviderRate(item.rate);
    const serviceId = item.service_id || normalizeProviderServiceId(item.service);
    if (rate == null || !serviceId) continue;
    payload.push({
      service: serviceId,
      rate,
      price: computeRetailPrice(rate, defaultMargin, rounding),
    });
  }
  return payload;
}

assert.equal(parseProviderRate("1.17"), 1.17);
assert.equal(parseProviderRate("$1.17"), 1.17);
assert.equal(parseProviderRate(0), null);
assert.equal(parseProviderRate(""), null);
assert.equal(parseProviderRate("0.00"), null);

assert.equal(normalizeProviderServiceId("6005"), "6005");
assert.equal(normalizeProviderServiceId(6005), "6005");
assert.equal(normalizeProviderServiceId("6005.0"), "6005");

const catalog = normalizeProviderCatalog({
  data: {
    services: [
      { service: "6005", name: "Test", rate: "1.17", min: 100, max: 10000 },
      { service: 6006, rate: 0 },
      { service_id: "7001", Rate: "$2.00" },
    ],
  },
});
const byId = Object.fromEntries(catalog.map((item) => [item.service_id, item.rate]));
assert.equal(byId["6005"], 1.17);
assert.equal(byId["6006"], undefined);
assert.equal(byId["7001"], 2);

const payload = buildSyncPayload(
  [
    { service: 6005, service_id: "6005", rate: 1.17 },
    { service: 1, service_id: "1", rate: 0 },
    { service: 2, service_id: "2", rate: null },
  ],
  15,
  "round2"
);
assert.equal(payload.length, 1);
assert.equal(payload[0].service, "6005");
assert.equal(payload[0].rate, 1.17);
assert.equal(payload[0].price, 1.35);

assert.equal(computeRetailPrice(1.17, 15, "round2"), 1.35);
assert.equal(computeRetailPrice(0.49, 15, "round2"), 0.56);
assert.equal(computeRetailPrice(0, 15, "round2"), 0);

const liveRates = new Map(catalog.map((item) => [item.service_id, item.rate]));
assert.equal(liveRates.get("6005"), 1.17);
assert.notEqual(liveRates.get("6005"), 0.49);

console.log("provider pricing sync tests passed");
console.log("service 6005 provider=1.17 global=15% selling=" + computeRetailPrice(1.17, 15));
