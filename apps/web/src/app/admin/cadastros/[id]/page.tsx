import type { Metadata } from "next";
import { ServiceError, getReviewDetail } from "@foccus/services";
import { notFound } from "next/navigation";
import { ReviewPanel } from "@/components/admin/ReviewPanel";
import { requirePagePermission } from "@/server/guard";
import { deps } from "@/server/services";

export const metadata: Metadata = { title: "Analisar cadastro" };
export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePagePermission("customers:documents.review", `/admin/cadastros/${id}`);
  const detail = await getReviewDetail(deps, ctx, id).catch((err) => {
    if (err instanceof ServiceError && err.status === 404) notFound();
    throw err;
  });
  return (
    <div className="container" style={{ paddingBlock: "24px", maxWidth: 1040 }}>
      <ReviewPanel initial={detail} />
    </div>
  );
}
