"use client";

import { useRouter } from "next/navigation";

export function useSignOut(): () => Promise<void> {
  const router = useRouter();

  return async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/sign-in");
    router.refresh();
  };
}
