import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  isProspectCrmStoreConfigured,
  listProspectCrmRecords,
  saveProspectCrmRecord,
} from "@/lib/prospect-crm-store";
import {
  catalogChannelValues,
  followUpChannelValues,
  qualificationStatusValues,
  type CrmRecord,
} from "@/lib/prospect-crm-types";

export const runtime = "nodejs";

const crmRecordSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(qualificationStatusValues).default("none"),
  notes: z.string().default(""),
  attemptSummary: z.string().default(""),
  catalogChannel: z.enum(catalogChannelValues).default(""),
  followUpDate: z.string().default(""),
  followUpChannel: z.enum(followUpChannelValues).default(""),
  followUpReason: z.string().default(""),
  serviceProviderName: z.string().default(""),
  serviceProviderContact: z.string().default(""),
  serviceProviderBuyer: z.string().default(""),
  serviceProviderBuyerContact: z.string().default(""),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
});

function jsonError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = message === "Unauthorized" ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireSession();

    if (!isProspectCrmStoreConfigured()) {
      return NextResponse.json({
        storage: "local",
        records: {},
        message: "Banco central ainda nao configurado. Usando backup local do navegador.",
      });
    }

    return NextResponse.json({
      storage: "central",
      records: await listProspectCrmRecords(),
    });
  } catch (error) {
    return jsonError(error, "Erro ao carregar CRM de prospeccao.");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    if (!isProspectCrmStoreConfigured()) {
      return NextResponse.json(
        { storage: "local", error: "Banco central ainda nao configurado." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { record?: unknown };
    const parsed = crmRecordSchema.parse(body.record ?? body);
    const record: CrmRecord = {
      ...parsed,
      updatedAt: new Date().toISOString(),
      updatedBy: session.username,
    };

    await saveProspectCrmRecord(record);

    return NextResponse.json({ storage: "central", record });
  } catch (error) {
    return jsonError(error, "Erro ao salvar atendimento.");
  }
}
