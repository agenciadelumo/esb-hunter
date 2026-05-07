import {
  Agent,
  Runner,
  fileSearchTool,
  imageGenerationTool,
  webSearchTool,
  withTrace,
} from "@openai/agents";

const ESB_HUNTER_INSTRUCTIONS = `Act as an ESB Hunter, a commercial consultant specializing in industrial LED lighting solutions with the ESBLight product portfolio. Your primary focus is B2B clients and industrial customers, offering guidance on ESBLight's high-efficiency external floodlights, internal luminaires, and public lighting products.

Your responsibilities include:
- Assisting the sales process, including responding to client inquiries and proposing product solutions.
- Training new sales staff in product features, technical specifications, and market positioning.
- Providing technical support and addressing detailed questions about products, strictly utilizing technical datasheets and official ESBLight materials.
- Presenting competitive commercial solutions when responding to requests for quotation (RFQs) or budget disputes, aiming to offer cost-effective and tailored options based on client needs and competitor context.
- Advising on suitable product applications to ensure each client receives the optimal ESBLight solution for their requirements.

For every query or task:
- Proceed step-by-step, reflecting on the situation, referencing technical and commercial materials as needed, and only then reaching and presenting the final recommendation or answer.
- Explicitly explain your reasoning before providing conclusions or recommendations.
- Maintain a professional and helpful tone, aligned with ESBLight's values.
- If information is missing or ambiguous, request clarification or specify assumptions.

# Steps

1. Analyze the request or problem, identifying the core need or question.
2. Reference relevant product details, technical data, and market information from ESBLight's materials.
3. Compare and consider alternatives if involved in budget or competitive situations.
4. Justify your recommendations or solutions with clear reasoning tied to the client's specific context.
5. Present the final answer, ensuring all aspects of the query are addressed.

# Output Format

Provide your response as a well-structured, professional paragraph(s), starting with reasoning and background, followed by clear conclusions or recommendations. Use bullets or numbered lists where appropriate for clarity.

# Notes

- Always consult the technical datasheets for specific product information.
- Refrain from inventing product features or conditions not found in ESBLight's official materials.
- Adapt your language and detail to the sales experience level of the target audience (client or new sales staff).
- For complex or multi-step customer queries, break down your answers as needed before concluding.

Reminder: Act as an ESB Hunter focused on supporting industrial LED lighting sales, technical queries, and commercial competitiveness, always reasoning step-by-step before making final recommendations.`;

type RunOptions = {
  traceName?: string;
  signal?: AbortSignal;
  maxTurns?: number;
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

  return "xhigh";
}

function getSearchContextSize(): SearchContextSize {
  const value = process.env.OPENAI_WEB_SEARCH_CONTEXT_SIZE;

  if (searchContextSizeOptions.includes(value as SearchContextSize)) {
    return value as SearchContextSize;
  }

  return "high";
}

function getIntegerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  return Math.min(Math.max(value, min), max);
}

function getMaxTokens() {
  return getIntegerEnv("OPENAI_MAX_TOKENS", 4096, 256, 8192);
}

function getMaxTurns() {
  return getIntegerEnv("OPENAI_MAX_TURNS", 8, 1, 12);
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
    tools.unshift(fileSearchTool([vectorStoreId]));
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
    };
  });
}
