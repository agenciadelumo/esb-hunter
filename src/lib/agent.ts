import {
  Agent,
  Runner,
  fileSearchTool,
  imageGenerationTool,
  webSearchTool,
  withTrace,
} from "@openai/agents";

const ESB_HUNTER_INSTRUCTIONS = `Você é o ESB-HUNTER, agente comercial especialista em iluminação LED profissional e industrial da ESBLight.

Prioridades:
- Apoiar vendas B2B, prospecção, qualificação de leads, propostas, objeções comerciais e comparativos técnicos.
- Usar o Catálogo ESBLight 2026, fichas técnicas e materiais carregados no File Search como fonte principal para especificações, aplicações, garantias, fluxo luminoso, eficiência, IP, IK e vida útil.
- Pesquisar concorrentes com Web Search quando o usuário pedir comparação, disputa comercial, referência de preço, posicionamento ou análise de mercado. Compare apenas informações públicas/verificáveis e deixe claro quando faltar dado técnico equivalente.
- Gerar imagens, conceitos visuais, mockups comerciais, layouts de iluminação e peças de apoio quando o usuário pedir material visual. Preserve uma linguagem visual profissional, técnica e alinhada à ESBLight.
- Quando uma imagem, QR Code, ficha técnica ou página do catálogo ajudar, cite o produto e a página do Catálogo ESBLight 2026. A interface poderá anexar as páginas visuais correspondentes.

Regras de resposta:
- Responda sempre em português do Brasil, com tom consultivo, prático e comercial.
- Não invente características técnicas, garantias, certificações, preços ou condições comerciais. Se a informação não estiver nos materiais ou na busca, diga o que falta e sugira o próximo passo.
- Mostre critérios objetivos de decisão antes da recomendação, sem expor raciocínio interno detalhado.
- Adapte o nível de detalhe ao público: vendedor iniciante, gestor comercial, cliente B2B, engenharia, compras ou manutenção.
- Em perguntas complexas, organize por contexto, análise técnica/comercial, recomendação e próximos passos.
- Em comparações com concorrentes, destaque equivalência técnica, riscos de especificação incompleta, diferenciais ESBLight e argumentos de valor sem depreciar marcas concorrentes.

Catálogo ESBLight 2026:
- High Bay e Modular: aplicações em centros de distribuição, armazéns, galpões e indústrias.
- Lineares IP69K, Advance, IP40 e IP20: aplicações internas, galpões, indústrias e supermercados.
- Projetores Slim, Modular, Blindado e RGBW: aplicações externas, quadras, fachadas, áreas de recreação, estacionamentos, portos, túneis e usinas.
- Ornamental Injetada Midi e linha pública Urban/SV/OS: aplicações públicas, praças, rodovias, condomínios, prefeituras e áreas urbanas.

Objetivo final: transformar informação técnica em ação comercial clara, ajudando o vendedor a escolher, argumentar, qualificar e avançar a oportunidade.`;

type RunOptions = {
  traceName?: string;
  signal?: AbortSignal;
  maxTurns?: number;
};

export type GeneratedImage = {
  src: string;
  label: string;
};

let cachedAgent: Agent | null = null;
const reasoningEffortOptions = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;
type ReasoningEffort = (typeof reasoningEffortOptions)[number];
const searchContextSizeOptions = ["low", "medium", "high"] as const;
type SearchContextSize = (typeof searchContextSizeOptions)[number];

function getVectorStoreId() {
  return process.env.OPENAI_VECTOR_STORE_ID;
}

function getWorkflowId() {
  return process.env.OPENAI_WORKFLOW_ID ?? "wf_69fb8134c93c8190aaea8925010df00c0361d6656709f266";
}

function getReasoningEffort(): ReasoningEffort {
  const value = process.env.OPENAI_REASONING_EFFORT;

  if (reasoningEffortOptions.includes(value as ReasoningEffort)) {
    return value as ReasoningEffort;
  }

  return "medium";
}

function getSearchContextSize(): SearchContextSize {
  const value = process.env.OPENAI_WEB_SEARCH_CONTEXT_SIZE;

  if (searchContextSizeOptions.includes(value as SearchContextSize)) {
    return value as SearchContextSize;
  }

  return "low";
}

function getIntegerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(value, min), max);
}

function getMaxTokens() {
  return getIntegerEnv("OPENAI_MAX_TOKENS", 1400, 256, 8192);
}

function getMaxTurns() {
  return getIntegerEnv("OPENAI_MAX_TURNS", 2, 1, 12);
}

function normalizeGeneratedImageSource(value: string) {
  if (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s/g, "").length > 800) {
    return `data:image/png;base64,${value.replace(/\s/g, "")}`;
  }

  return null;
}

function collectGeneratedImages(value: unknown, images: GeneratedImage[], seen = new WeakSet<object>(), depth = 0, imageContext = false) {
  if (images.length >= 4 || depth > 8 || value == null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectGeneratedImages(item, images, seen, depth + 1, imageContext);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);
  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  const name = typeof record.name === "string" ? record.name.toLowerCase() : "";
  const nextImageContext = imageContext || type.includes("image") || name.includes("image_generation");

  if (nextImageContext) {
    for (const key of ["image", "image_url", "url", "result", "output"]) {
      const source = record[key];

      if (typeof source === "string") {
        const src = normalizeGeneratedImageSource(source);

        if (src && !images.some((image) => image.src === src)) {
          images.push({ src, label: "Imagem gerada pelo ESB-HUNTER" });
        }
      }
    }
  }

  for (const child of Object.values(record)) {
    collectGeneratedImages(child, images, seen, depth + 1, nextImageContext);
  }
}

function extractGeneratedImages(result: unknown) {
  const images: GeneratedImage[] = [];
  collectGeneratedImages(result, images);
  return images;
}

function buildAgent() {
  if (cachedAgent) {
    return cachedAgent;
  }

  const tools = [
    webSearchTool({
      userLocation: {
        type: "approximate",
        timezone: "America/Sao_Paulo",
      },
      searchContextSize: getSearchContextSize(),
      externalWebAccess: true,
    }),
    imageGenerationTool({
      model: "chatgpt-image-latest",
      size: "auto",
      quality: "high",
      outputFormat: "png",
      background: "auto",
      moderation: "auto",
    }),
  ];

  const vectorStoreId = getVectorStoreId();

  if (vectorStoreId) {
    tools.unshift(
      fileSearchTool([vectorStoreId], {
        maxNumResults: 10,
      }),
    );
  }

  cachedAgent = new Agent({
    name: "ESB-HUNTER",
    instructions: ESB_HUNTER_INSTRUCTIONS,
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    tools,
    modelSettings: {
      reasoning: {
        effort: getReasoningEffort(),
        summary: "auto",
      },
      maxTokens: getMaxTokens(),
      store: true,
    },
  });

  return cachedAgent;
}

export async function runEsbHunter(input: string, options: RunOptions = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return withTrace(options.traceName ?? "ESB-HUNT", async () => {
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: getWorkflowId(),
      },
    });
    const result = await runner.run(buildAgent(), input, {
      maxTurns: options.maxTurns ?? getMaxTurns(),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!result.finalOutput) {
      throw new Error("Agent result is undefined");
    }

    return {
      output_text: result.finalOutput,
      generated_images: extractGeneratedImages(result),
    };
  });
}
