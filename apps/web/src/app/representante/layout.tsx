import type { ReactNode } from "react";
import { AreaLayout } from "@/components/shell/AreaLayout";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return <AreaLayout area="representante">{children}</AreaLayout>;
}
