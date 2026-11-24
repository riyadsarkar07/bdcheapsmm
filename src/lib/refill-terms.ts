/** Read provider catalog flags and only display a period explicitly tied to refill. */
export function refillTerms(meta: unknown, name = "", description = "") {
  const fields = meta && typeof meta === "object" ? meta as Record<string, unknown> : {};
  const flag = String(fields.refill ?? "").trim().toLowerCase();
  const text = name + " " + description;
  const days = text.match(/\b(\d+)\s*[- ]?days?\s+refill\b/i)?.[1]
    ?? text.match(/\brefill\s*[:(-]?\s*(\d+)\s*[- ]?days?\b/i)?.[1];
  const disabled = ["false", "0", "no"].includes(flag) || /\b(?:no|without)\s+refill\b/i.test(text);
  const supported = ["true", "1", "yes"].includes(flag) || !!days;
  const label = disabled ? "Not available for this service" : days ? days + " days" : supported ? "Available · period not specified" : "Provider has not specified refill terms";
  return { disabled, label };
}
