import { ModulePage, moduleMetadata } from "@/components/shell/ModulePage";

export const metadata = moduleMetadata("admin/configuracoes");

export default function Page() {
  return <ModulePage id="admin/configuracoes" />;
}
