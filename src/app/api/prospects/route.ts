import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { runEsbHunter } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

function getIntegerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(value, min), max);
}

function getProspectsTimeoutMs() {
  return getIntegerEnv("PROSPECTS_TIMEOUT_MS", 285_000, 5_000, 295_000);
}

function getProspectsMaxTurns() {
  return getIntegerEnv("OPENAI_MAX_TURNS", 4, 1, 12);
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("abort"));
}

type Prospect = {
  name: string;
  segment: string;
  city: string;
  state: string;
  fitScore: number;
  reason: string;
  nextStep: string;
  searchHint: string;
  sourceUrl?: string;
};

function extractJsonArray(text: string): Prospect[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Prospect[];

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.map((item) => ({
      name: String(item.name ?? "Empresa sem nome"),
      segment: String(item.segment ?? "Industrial"),
      city: String(item.city ?? "São Paulo"),
      state: String(item.state ?? "SP"),
      fitScore: Number(item.fitScore ?? 70),
      reason: String(item.reason ?? "Potencial aderente ao portfólio ESBLight."),
      nextStep: String(item.nextStep ?? "Validar responsável de compras/manutenção e abrir contato."),
      searchHint: String(item.searchHint ?? ""),
      sourceUrl: item.sourceUrl ? String(item.sourceUrl) : undefined,
    }));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), getProspectsTimeoutMs());

  try {
    await requireSession();
    const { segment, region, notes } = (await request.json()) as {
      segment?: string;
      region?: string;
      notes?: string;
    };

    const prompt = `Você é o ESB-HUNTER apoiando prospecção B2B de iluminação LED industrial.

Busque e sugira até 8 empresas-alvo para abordagem comercial.

Parâmetros:
- Segmento: ${segment || "indústrias, condomínios logísticos, galpões e iluminação pública"}
- Região: ${region || "Brasil, priorizando Sudeste e Sul"}
- Observações: ${notes || "priorizar contas com alto consumo de iluminação, operação em galpões, pátios, áreas externas ou manutenção industrial"}

Use busca na web quando útil. Retorne somente JSON válido, sem markdown, no formato:
[
  {
    "name": "Nome da empresa",
    "segment": "Segmento",
    "city": "Cidade",
    "state": "UF",
    "fitScore": 0-100,
    "reason": "Por que combina com ESBLight",
    "nextStep": "Próximo passo comercial",
    "searchHint": "Termos úteis para localizar decisor ou unidade",
    "sourceUrl": "URL pública quando houver"
  }
]`;

    const result = await runEsbHunter(prompt, {
      traceName: "ESB-HUNTER Prospects",
      signal: timeoutController.signal,
      maxTurns: getProspectsMaxTurns(),
    });
    const prospects = extractJsonArray(result.output_text);

    return NextResponse.json({
      prospects: prospects ?? [],
      raw: prospects ? undefined : result.output_text,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json(
        { error: "A busca de empresas demorou mais que o limite da Vercel. Tente reduzir segmento, região ou filtros." },
        { status: 504 },
      );
    }

    const message = error instanceof Error ? error.message : "Erro ao buscar empresas.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  } finally {
    clearTimeout(timeout);
  }
}
