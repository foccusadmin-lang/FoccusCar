import { ModulePage, moduleMetadata } from "@/components/shell/ModulePage";

export const metadata = moduleMetadata("admin/financeiro");

export default function Page() {
  return <ModulePage id="admin/financeiro" />;
}
