import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "esb_hunter_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 10;

type SessionPayload = {
  username: string;
  iat: number;
  exp: number;
};

export type Session = {
  username: string;
};

function readRequiredEnv(name: string, devFallback?: string) {
  const value = process.env[name];

  if (value) {
    return value;
  }

  if (process.env.NODE_ENV !== "production" && devFallback) {
    return devFallback;
  }

  throw new Error(`Missing required environment variable: ${name}`);
}

export function getAuthConfig() {
  return {
    username: readRequiredEnv("AUTH_USERNAME", "comercial"),
    password: readRequiredEnv("AUTH_PASSWORD", "comercial123"),
    secret: readRequiredEnv("SESSION_SECRET", "dev-only-esb-hunter-secret-change-me"),
  };
}

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", getAuthConfig().secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function createToken(username: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    username,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyToken(token?: string): Session | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;

    if (!payload.username || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { username: payload.username };
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function setSession(username: string) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: COOKIE_NAME,
    value: createToken(username),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}
