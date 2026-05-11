import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { runEsbHunter } from "@/lib/agent";
import { findCatalogReferences } from "@/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function getIntegerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(value, min), max);
}

function getChatTimeoutMs() {
  return getIntegerEnv("CHAT_TIMEOUT_MS", 285_000, 5_000, 295_000);
}

function getChatMaxTurns() {
  return getIntegerEnv("OPENAI_MAX_TURNS", 2, 1, 12);
}

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.message.toLowerCase().includes("abort"));
}

function buildPrompt(message: string, history: ChatMessage[] = []) {
  const recentHistory = history
    .slice(-10)
    .map((item) => `${item.role === "user" ? "Comercial" : "ESB-HUNTER"}: ${item.content}`)
    .join("\n\n");

  return `Contexto de atendimento comercial ESBLight.

Histórico recente:
${recentHistory || "Sem histórico anterior neste atendimento."}

Solicitação atual do comercial:
${message}

Instruções específicas desta conversa:
- Responda em português do Brasil, com foco prático para venda B2B industrial.
- Use o Catálogo ESBLight 2026 e os materiais do File Search como referência técnica principal.
- Para concorrentes, use Web Search e compare somente dados públicos ou claramente verificáveis.
- Quando fizer sentido mostrar imagem, QR Code, ficha ou página do catálogo, mencione o produto e a página aproximada do Catálogo ESBLight 2026.
- Se o pedido for criar imagem, mockup ou peça visual, use a ferramenta de geração de imagens e explique como o material pode ser usado comercialmente.`;
}

export async function POST(request: Request) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), getChatTimeoutMs());

  try {
    await requireSession();
    const { message, history } = (await request.json()) as {
      message?: string;
      history?: ChatMessage[];
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
    }

    const result = await runEsbHunter(buildPrompt(message.trim(), history), {
      traceName: "ESB-HUNTER Chat",
      signal: timeoutController.signal,
      maxTurns: getChatMaxTurns(),
    });

    const catalogReferences = findCatalogReferences(`${message}\n${result.output_text}`, 3);

    return NextResponse.json({
      message: result.output_text,
      catalogReferences,
      generatedImages: result.generated_images,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json(
        { error: "O agente demorou mais que o limite da Vercel. Tente uma pergunta mais objetiva ou divida em etapas." },
        { status: 504 },
      );
    }

    const message = error instanceof Error ? error.message : "Erro ao executar o agente.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  } finally {
    clearTimeout(timeout);
  }
}
