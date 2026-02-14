import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/api/auth";
import { safeRedirect } from "@/lib/safeRedirect";
import { LoginForm } from "./LoginForm";

/**
 * Server component wrapper: checks session server-side and redirects
 * already-authenticated users. Eliminates the client-side auth check
 * race that previously caused the infinite "Loading..." spinner.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const rawNext = Array.isArray(searchParams?.next)
    ? searchParams.next[0]
    : searchParams?.next;
  const next = safeRedirect(rawNext, "/feed");

  const cookieHeader = cookies().toString();
  const session = await getSession(cookieHeader);

  if (session.user) {
    redirect(next);
  }

  return <LoginForm next={next} sessionUnavailable={session.unavailable} />;
}
