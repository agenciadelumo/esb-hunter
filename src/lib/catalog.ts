import catalogPages from "@/data/esblight-catalog-pages.json";

export type CatalogReference = {
  page: number;
  image: string;
  title: string;
  excerpt: string;
};

type CatalogPage = CatalogReference & {
  text: string;
};

const pages = catalogPages as CatalogPage[];

const stopwords = new Set([
  "para",
  "pela",
  "pelo",
  "com",
  "sem",
  "uma",
  "uns",
  "das",
  "dos",
  "que",
  "qual",
  "quais",
  "sobre",
  "cliente",
  "clientes",
  "venda",
  "vendas",
  "produto",
  "produtos",
  "solucao",
  "solucoes",
  "esblight",
  "hunter",
]);

const expansions: Record<string, string[]> = {
  armazem: ["galpoes", "industria", "high", "bay", "linear"],
  armazens: ["galpoes", "industria", "high", "bay", "linear"],
  condominio: ["publica", "urban", "ornamental", "projetor"],
  fachadas: ["projetor", "blindado", "modular", "rgbw"],
  galpao: ["armazens", "industrias", "high", "bay", "linear"],
  galpoes: ["armazens", "industrias", "high", "bay", "linear"],
  industrial: ["industria", "industrias", "galpoes", "high", "bay", "linear"],
  iluminacao: ["luminaria", "projetor", "led"],
  luminaria: ["luminarias", "high", "bay", "linear", "publica"],
  patio: ["externa", "projetor", "blindado", "modular"],
  publica: ["urban", "poste", "rodovia", "lente", "temperado"],
  qrcode: ["ficha", "tecnica", "manual", "acesso"],
  qr: ["ficha", "tecnica", "manual", "acesso"],
  rodovia: ["publica", "urban", "poste", "luminaria"],
  rodovias: ["publica", "urban", "poste", "luminaria"],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function expandTokens(tokens: string[]) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    for (const extra of expansions[token] ?? []) {
      expanded.add(extra);
    }
  }

  return [...expanded];
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) {
    return 0;
  }

  return haystack.split(needle).length - 1;
}

function wantsVisualReference(query: string) {
  const normalized = normalize(query);
  return /\b(catalogo|pagina|imagem|foto|visual|qr|qrcode|ficha|manual|referencia|mostrar|apresente)\b/.test(normalized);
}

function toReference(page: CatalogPage): CatalogReference {
  return {
    page: page.page,
    image: page.image,
    title: page.title,
    excerpt: page.excerpt.length > 190 ? `${page.excerpt.slice(0, 187)}...` : page.excerpt,
  };
}

export function findCatalogReferences(query: string, limit = 3): CatalogReference[] {
  const tokens = expandTokens(tokenize(query));
  const shouldAttachVisuals = wantsVisualReference(query);

  if (!tokens.length && !shouldAttachVisuals) {
    return [];
  }

  const scored = pages
    .map((page) => {
      const title = normalize(page.title);
      const excerpt = normalize(page.excerpt);
      const text = normalize(`${page.title} ${page.excerpt} ${page.text}`);
      let score = shouldAttachVisuals && page.page === 1 ? 1.5 : 0;

      for (const token of tokens) {
        if (title.includes(token)) {
          score += 8;
        }

        if (excerpt.includes(token)) {
          score += 3;
        }

        score += Math.min(countOccurrences(text, token), 6);
      }

      return { page, score };
    })
    .filter(({ score }) => score > (shouldAttachVisuals ? 0 : 1))
    .sort((left, right) => right.score - left.score || left.page.page - right.page.page);

  if (!scored.length && shouldAttachVisuals) {
    return pages.slice(0, Math.max(1, limit)).map(toReference);
  }

  return scored.slice(0, limit).map(({ page }) => toReference(page));
}
