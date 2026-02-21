"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserOut } from "@zinovia/contracts";

type SessionContextValue = {
  user: UserOut | null;
  unavailable: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  user: null,
  unavailable: false,
});

export function SessionProvider({
  user,
  unavailable = false,
  children,
}: {
  user: UserOut | null;
  unavailable?: boolean;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={{ user, unavailable }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
