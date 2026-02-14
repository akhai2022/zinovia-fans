export type BillingReturnUrls = {
  successUrl: string;
  cancelUrl: string;
};

export function buildBillingReturnUrls(origin: string, returnPath: string): BillingReturnUrls {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const safeReturn = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  const encodedReturn = encodeURIComponent(safeReturn);
  return {
    successUrl: `${normalizedOrigin}/billing/success?return=${encodedReturn}`,
    cancelUrl: `${normalizedOrigin}/billing/cancel?return=${encodedReturn}`,
  };
}
