import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteProspectCrmRecord, isProspectCrmStoreConfigured } from "@/lib/prospect-crm-store";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ leadId: string }>;
  },
) {
  try {
    await requireSession();

    if (!isProspectCrmStoreConfigured()) {
      return NextResponse.json(
        { storage: "local", error: "Banco central ainda não configurado." },
        { status: 503 },
      );
    }

    const { leadId } = await context.params;

    if (!leadId) {
      return NextResponse.json({ error: "Lead inválido." }, { status: 400 });
    }

    await deleteProspectCrmRecord(decodeURIComponent(leadId));
    return NextResponse.json({ ok: true, storage: "central" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao apagar atendimento.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
