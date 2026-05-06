import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { runEsbHunter } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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

Responda em português do Brasil, com foco prático para venda B2B industrial.`;
}

export async function POST(request: Request) {
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
    });

    return NextResponse.json({ message: result.output_text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao executar o agente.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
