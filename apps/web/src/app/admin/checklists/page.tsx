import { ModulePage, moduleMetadata } from "@/components/shell/ModulePage";

export const metadata = moduleMetadata("admin/checklists");

export default function Page() {
  return <ModulePage id="admin/checklists" />;
}
