import { NextResponse } from "next/server";
import { getAuthConfig, setSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password } = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const config = getAuthConfig();

    if (username !== config.username || password !== config.password) {
      return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    await setSession(config.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao autenticar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
