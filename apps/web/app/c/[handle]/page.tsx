import { redirect } from "next/navigation";

/**
 * Legacy route: redirect /c/[handle] to canonical /creators/[handle].
 */
export default function CHandleRedirect({
  params,
}: {
  params: { handle: string };
}) {
  const handle =
    typeof params.handle === "string" ? params.handle : params.handle[0];
  redirect(`/creators/${handle}`);
}
