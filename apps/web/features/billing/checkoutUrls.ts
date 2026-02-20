export type BillingReturnUrls = {
  successUrl: string;
  cancelUrl: string;
};

export function buildBillingReturnUrls(
  origin: string,
  returnPath: string,
  opts?: { creatorId?: string; creatorHandle?: string },
): BillingReturnUrls {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const safeReturn = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  const encodedReturn = encodeURIComponent(safeReturn);
  const params = new URLSearchParams({ return: encodedReturn });
  if (opts?.creatorId) params.set("creator_id", opts.creatorId);
  if (opts?.creatorHandle) params.set("creator_handle", opts.creatorHandle);
  return {
    successUrl: `${normalizedOrigin}/billing/success?${params.toString()}`,
    cancelUrl: `${normalizedOrigin}/billing/cancel?${params.toString()}`,
  };
}
