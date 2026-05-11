import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

async function openaiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `OpenAI request failed with status ${response.status}`);
  }

  return JSON.parse(text) as T;
}

type UploadedFile = {
  id: string;
  filename: string;
  bytes: number;
};

type VectorStoreFile = {
  id: string;
  status: "in_progress" | "completed" | "cancelled" | "failed";
  last_error?: { message?: string } | null;
};

async function pollVectorStoreFile(vectorStoreId: string, fileId: string) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const vectorFile = await openaiFetch<VectorStoreFile>(`/vector_stores/${vectorStoreId}/files/${fileId}`, {
      method: "GET",
    });

    if (vectorFile.status !== "in_progress") {
      return vectorFile;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return null;
}

export async function POST(request: Request) {
  try {
    await requireSession();

    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

    if (!vectorStoreId) {
      return NextResponse.json({ error: "OPENAI_VECTOR_STORE_ID não configurado." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    const uploadBody = new FormData();
    uploadBody.append("purpose", "assistants");
    uploadBody.append("file", file, file.name);

    const uploaded = await openaiFetch<UploadedFile>("/files", {
      method: "POST",
      body: uploadBody,
    });

    const filename = file.name.slice(0, 512);
    const normalizedFilename = filename
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const isEsbCatalog = normalizedFilename.includes("esblight") && normalizedFilename.includes("catalog");

    const vectorFile = await openaiFetch<VectorStoreFile>(`/vector_stores/${vectorStoreId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_id: uploaded.id,
        attributes: {
          source: "esb-hunter",
          filename,
          ...(isEsbCatalog
            ? {
                catalog: "ESBLight Catalog 2026",
                contains_visual_references: "true",
              }
            : {}),
        },
      }),
    });

    const finalVectorFile = await pollVectorStoreFile(vectorStoreId, uploaded.id);

    return NextResponse.json({
      file: uploaded,
      vectorStoreFile: finalVectorFile ?? vectorFile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar arquivo.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
