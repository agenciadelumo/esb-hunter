import type { CrmRecord } from "@/lib/prospect-crm-types";

const CRM_HASH_KEY = "esb-hunter:prospect-crm-records";

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.KV_REST_API_READ_WRITE_TOKEN;

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    token,
  };
}

export function isProspectCrmStoreConfigured() {
  return Boolean(getUpstashConfig());
}

async function runRedisCommand<T>(command: Array<string | number>) {
  const config = getUpstashConfig();

  if (!config) {
    throw new Error("Banco central não configurado.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const payload = (await response.json()) as UpstashResponse<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Falha ao acessar o banco central.");
  }

  return payload.result as T;
}

function parseRecord(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value) as CrmRecord;
  } catch {
    return null;
  }
}

function recordsFromHash(result: unknown) {
  const records: Record<string, CrmRecord> = {};

  if (Array.isArray(result)) {
    for (let index = 0; index < result.length; index += 2) {
      const leadId = String(result[index] ?? "");
      const record = parseRecord(result[index + 1]);

      if (leadId && record) {
        records[leadId] = record;
      }
    }

    return records;
  }

  if (result && typeof result === "object") {
    for (const [leadId, value] of Object.entries(result)) {
      const record = parseRecord(value);

      if (record) {
        records[leadId] = record;
      }
    }
  }

  return records;
}

export async function listProspectCrmRecords() {
  const result = await runRedisCommand<unknown>(["HGETALL", CRM_HASH_KEY]);
  return recordsFromHash(result);
}

export async function saveProspectCrmRecord(record: CrmRecord) {
  await runRedisCommand<number>(["HSET", CRM_HASH_KEY, record.leadId, JSON.stringify(record)]);
  return record;
}

export async function deleteProspectCrmRecord(leadId: string) {
  await runRedisCommand<number>(["HDEL", CRM_HASH_KEY, leadId]);
}
