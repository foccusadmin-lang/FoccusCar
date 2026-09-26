"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/Button";

export function SignOutButton() {
  return (
    <Button variant="ghost" onClick={async () => { await authClient.signOut(); window.location.href = "/"; }}>
      Sair da conta
    </Button>
  );
}
