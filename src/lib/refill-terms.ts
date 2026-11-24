export function providerRefillFlag(value: unknown): boolean | null {
  const flag = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(flag)) return true;
  if (["false", "0", "no"].includes(flag)) return false;
  return null;
}

/** Read provider catalog flags and only display a period explicitly tied to refill. */
export function refillTerms(meta: unknown, name = "", description = "") {
  const fields = meta && typeof meta === "object" ? meta as Record<string, unknown> : {};
  const flag = providerRefillFlag(fields.refill);
  const text = name + " " + description;
  const codedDays = name.match(/(?:^|[|•])\s*R([1-9]\d{0,3})\s*(?=$|[|•])/i)?.[1];
  const days = text.match(/\b(\d+)\s*[- ]?days?\s+refill\b/i)?.[1]
    ?? text.match(/\brefill\s*[:(-]?\s*(\d+)\s*[- ]?days?\b/i)?.[1] ?? codedDays;
  const disabled = flag === false || (flag === null && /\b(?:no|without)\s+refill\b/i.test(text));
  const supported = flag === true || !!days;
  if (disabled && days) return { disabled, label: `Listed as ${days} days · automatic refill unavailable` };
  const label = disabled ? "Listed without automatic refill" : days ? days + " days" : supported ? "Available · period not specified" : "Provider has not specified refill terms";
  return { disabled, label };
}
