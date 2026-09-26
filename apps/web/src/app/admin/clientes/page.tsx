import { ModulePage, moduleMetadata } from "@/components/shell/ModulePage";

export const metadata = moduleMetadata("admin/clientes");

export default function Page() {
  return <ModulePage id="admin/clientes" />;
}
