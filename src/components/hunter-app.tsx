"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ClipboardCheck,
  Columns3,
  Download,
  FileText,
  Loader2,
  LogOut,
  MapPinned,
  MessageSquare,
  Rows3,
  Search,
  Send,
  Sparkles,
  Table2,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { cn, uid } from "@/lib/utils";

type TabId = "chat" | "prospects" | "files" | "sheets";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type UploadedRecord = {
  id: string;
  filename: string;
  status: string;
  bytes: number;
  createdAt: string;
};

type Prospect = {
  id: string;
  name: string;
  segment: string;
  city: string;
  state: string;
  fitScore: number;
  reason: string;
  nextStep: string;
  searchHint: string;
  sourceUrl?: string;
  status: "novo" | "qualificar" | "contatar" | "proposta";
};

const tabs: Array<{ id: TabId; label: string; icon: typeof MessageSquare }> = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "prospects", label: "Prospecção", icon: MapPinned },
  { id: "files", label: "Arquivos", icon: FileText },
  { id: "sheets", label: "Planilhas", icon: Table2 },
];

const starterMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    createdAt: "2026-01-01T00:00:00.000Z",
    content:
      "Pronto para apoiar o comercial ESBLight. Posso analisar especificações, comparar alternativas, preparar argumentos de proposta, buscar empresas B2B e usar os arquivos técnicos do vector store configurado.",
  },
];

function readStorage<T>(key: string, fallback: T) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatMessageTime(message: Message) {
  if (message.id === "welcome") {
    return "Mensagem inicial";
  }

  return new Date(message.createdAt).toLocaleString("pt-BR");
}

export function HunterApp({ username }: { username: string }) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [uploads, setUploads] = useState<UploadedRecord[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      setMessages(readStorage("esb-hunter:messages", starterMessages));
      setUploads(readStorage("esb-hunter:uploads", []));
      setProspects(readStorage("esb-hunter:prospects", []));
      setIsHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem("esb-hunter:messages", JSON.stringify(messages));
  }, [isHydrated, messages]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem("esb-hunter:uploads", JSON.stringify(uploads));
  }, [isHydrated, uploads]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem("esb-hunter:prospects", JSON.stringify(prospects));
  }, [isHydrated, prospects]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function sendToChat(prompt: string) {
    setChatDraft(prompt);
    setActiveTab("chat");
  }

  const stats = useMemo(
    () => [
      { label: "Mensagens", value: messages.filter((item) => item.role === "user").length },
      { label: "Arquivos", value: uploads.length },
      { label: "Prospects", value: prospects.length },
    ],
    [messages, prospects.length, uploads.length],
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon">
            <Target size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Agente comercial</p>
            <h1>ESB-HUNTER</h1>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Áreas do app">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={cn("nav-button", activeTab === tab.id && "active")}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <span>{username.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{username}</strong>
              <small>sessão ativa</small>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={handleLogout}>
            <LogOut size={17} aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Console de vendas B2B</p>
            <h2>{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
          </div>
          <div className="stats-row">
            {stats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </header>

        {activeTab === "chat" ? (
          <ChatPanel
            messages={messages}
            setMessages={setMessages}
            draft={chatDraft}
            setDraft={setChatDraft}
          />
        ) : null}
        {activeTab === "prospects" ? (
          <ProspectingPanel prospects={prospects} setProspects={setProspects} onSendToChat={sendToChat} />
        ) : null}
        {activeTab === "files" ? <FilesPanel uploads={uploads} setUploads={setUploads} onSendToChat={sendToChat} /> : null}
        {activeTab === "sheets" ? <SpreadsheetPanel onSendToChat={sendToChat} /> : null}
      </section>
    </main>
  );
}

function ChatPanel({
  messages,
  setMessages,
  draft,
  setDraft,
}: {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  draft: string;
  setDraft: (draft: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!text || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: uid("msg"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao consultar o agente.");
      }

      setMessages([
        ...nextMessages,
        {
          id: uid("msg"),
          role: "assistant",
          content: payload.message,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao consultar o agente.");
      setMessages(nextMessages);
    } finally {
      setIsLoading(false);
    }
  }

  function clearHistory() {
    setMessages(starterMessages);
  }

  return (
    <section className="content-grid chat-grid">
      <div className="chat-stream" aria-live="polite">
        {messages.map((message) => (
          <article className={cn("message-bubble", message.role)} key={message.id}>
            <div className="message-meta">
              <strong>{message.role === "user" ? "Comercial" : "ESB-HUNTER"}</strong>
              <span>{formatMessageTime(message)}</span>
            </div>
            <p>{message.content}</p>
          </article>
        ))}
        {isLoading ? (
          <article className="message-bubble assistant loading-message">
            <Loader2 className="spin" size={18} aria-hidden="true" />
            Consultando materiais, web e contexto comercial...
          </article>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <aside className="tool-panel">
        <div className="tool-panel-header">
          <Sparkles size={18} aria-hidden="true" />
          <h3>Ações rápidas</h3>
        </div>
        <button
          className="quick-action"
          type="button"
          onClick={() =>
            setDraft(
              "Crie uma abordagem comercial para um cliente industrial que quer reduzir consumo de energia em galpões e áreas externas.",
            )
          }
        >
          Abordagem B2B
        </button>
        <button
          className="quick-action"
          type="button"
          onClick={() =>
            setDraft("Compare opções ESBLight para iluminação de pátio externo, docas logísticas e área de armazenagem.")
          }
        >
          Comparar soluções
        </button>
        <button
          className="quick-action"
          type="button"
          onClick={() => setDraft("Monte um roteiro de perguntas de diagnóstico para qualificar um lead industrial.")}
        >
          Qualificar lead
        </button>
        <div className="tool-actions">
          <button className="ghost-button" type="button" onClick={() => downloadJson("esb-hunter-historico.json", messages)}>
            <Download size={16} aria-hidden="true" />
            Exportar
          </button>
          <button className="ghost-button danger" type="button" onClick={clearHistory}>
            <Trash2 size={16} aria-hidden="true" />
            Limpar
          </button>
        </div>
      </aside>

      <form className="composer" onSubmit={handleSubmit}>
        {error ? <p className="form-error">{error}</p> : null}
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Peça uma recomendação, proposta, análise técnica ou apoio de prospecção..."
          rows={4}
        />
        <button className="primary-button" type="submit" disabled={isLoading || !draft.trim()}>
          {isLoading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
          Enviar
        </button>
      </form>
    </section>
  );
}

function FilesPanel({
  uploads,
  setUploads,
  onSendToChat,
}: {
  uploads: UploadedRecord[];
  setUploads: (uploads: UploadedRecord[]) => void;
  onSendToChat: (prompt: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha no upload.");
      }

      setUploads([
        {
          id: payload.file.id,
          filename: payload.file.filename,
          bytes: payload.file.bytes,
          status: payload.vectorStoreFile.status,
          createdAt: new Date().toISOString(),
        },
        ...uploads,
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha no upload.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <section className="content-grid file-grid">
      <div className="upload-zone">
        <Upload size={28} aria-hidden="true" />
        <h3>Adicionar material ao File Search</h3>
        <p>Envie catálogos, fichas técnicas, listas de preço, CSVs ou documentos comerciais para o vector store configurado.</p>
        <label className="file-input-button">
          {isUploading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
          Selecionar arquivo
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.json"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
      </div>

      <div className="records-panel">
        <div className="section-title">
          <h3>Arquivos enviados</h3>
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              onSendToChat(
                "Consulte os materiais técnicos carregados no File Search e resuma os pontos mais úteis para uma proposta comercial ESBLight.",
              )
            }
          >
            <MessageSquare size={16} aria-hidden="true" />
            Perguntar ao agente
          </button>
        </div>
        <div className="record-list">
          {uploads.length ? (
            uploads.map((upload) => (
              <article className="record-card" key={upload.id}>
                <FileText size={18} aria-hidden="true" />
                <div>
                  <strong>{upload.filename}</strong>
                  <span>
                    {(upload.bytes / 1024).toFixed(1)} KB · {upload.status}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">Nenhum arquivo enviado nesta sessão.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ProspectingPanel({
  prospects,
  setProspects,
  onSendToChat,
}: {
  prospects: Prospect[];
  setProspects: (prospects: Prospect[]) => void;
  onSendToChat: (prompt: string) => void;
}) {
  const [segment, setSegment] = useState("indústrias, galpões logísticos e condomínios empresariais");
  const [region, setRegion] = useState("São Paulo, Paraná e Santa Catarina");
  const [notes, setNotes] = useState("priorizar empresas com áreas externas, docas, pátios e alto custo de energia");
  const [raw, setRaw] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    setRaw("");

    try {
      const response = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, region, notes }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao buscar empresas.");
      }

      const nextProspects: Prospect[] = (payload.prospects ?? []).map((item: Omit<Prospect, "id" | "status">) => ({
        ...item,
        id: uid("prospect"),
        status: "novo",
      }));

      if (nextProspects.length) {
        setProspects([...nextProspects, ...prospects]);
      }

      if (payload.raw) {
        setRaw(payload.raw);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao buscar empresas.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateStatus(id: string, status: Prospect["status"]) {
    setProspects(prospects.map((prospect) => (prospect.id === id ? { ...prospect, status } : prospect)));
  }

  return (
    <section className="content-grid prospect-grid">
      <form className="search-panel" onSubmit={handleSearch}>
        <div className="tool-panel-header">
          <Search size={18} aria-hidden="true" />
          <h3>Busca B2B</h3>
        </div>
        <label>
          Segmento
          <input value={segment} onChange={(event) => setSegment(event.target.value)} />
        </label>
        <label>
          Região
          <input value={region} onChange={(event) => setRegion(event.target.value)} />
        </label>
        <label>
          Critérios de oportunidade
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Building2 size={18} aria-hidden="true" />}
          Buscar empresas
        </button>
      </form>

      <ProspectMap prospects={prospects} />

      <div className="records-panel prospect-list-panel">
        <div className="section-title">
          <h3>Pipeline</h3>
          <button
            className="ghost-button"
            type="button"
            onClick={() => downloadJson("esb-hunter-prospects.json", prospects)}
            disabled={!prospects.length}
          >
            <Download size={16} aria-hidden="true" />
            Exportar
          </button>
        </div>
        {raw ? <pre className="raw-output">{raw}</pre> : null}
        <div className="prospect-list">
          {prospects.length ? (
            prospects.map((prospect) => (
              <article className="prospect-card" key={prospect.id}>
                <div className="prospect-heading">
                  <div>
                    <strong>{prospect.name}</strong>
                    <span>
                      {prospect.segment} · {prospect.city}/{prospect.state}
                    </span>
                  </div>
                  <b>{Math.round(prospect.fitScore)}</b>
                </div>
                <p>{prospect.reason}</p>
                <small>{prospect.nextStep}</small>
                <div className="prospect-actions">
                  <select value={prospect.status} onChange={(event) => updateStatus(prospect.id, event.target.value as Prospect["status"])}>
                    <option value="novo">Novo</option>
                    <option value="qualificar">Qualificar</option>
                    <option value="contatar">Contatar</option>
                    <option value="proposta">Proposta</option>
                  </select>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      onSendToChat(
                        `Prepare uma abordagem comercial para ${prospect.name}, segmento ${prospect.segment}, em ${prospect.city}/${prospect.state}. Motivo da oportunidade: ${prospect.reason}. Próximo passo: ${prospect.nextStep}.`,
                      )
                    }
                  >
                    <MessageSquare size={15} aria-hidden="true" />
                    Abordar
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">Use a busca B2B para montar o primeiro lote de contas-alvo.</p>
          )}
        </div>
      </div>
    </section>
  );
}

const cityPins: Record<string, { x: number; y: number }> = {
  "são paulo-sp": { x: 58, y: 63 },
  "campinas-sp": { x: 55, y: 60 },
  "guarulhos-sp": { x: 59, y: 62 },
  "são bernardo do campo-sp": { x: 59, y: 65 },
  "rio de janeiro-rj": { x: 66, y: 65 },
  "belo horizonte-mg": { x: 61, y: 54 },
  "curitiba-pr": { x: 53, y: 72 },
  "joinville-sc": { x: 55, y: 76 },
  "caxias do sul-rs": { x: 48, y: 83 },
  "porto alegre-rs": { x: 48, y: 87 },
  "goiânia-go": { x: 49, y: 47 },
  "salvador-ba": { x: 72, y: 42 },
  "recife-pe": { x: 79, y: 31 },
  "fortaleza-ce": { x: 73, y: 24 },
  "manaus-am": { x: 28, y: 25 },
};

const stateFallback: Record<string, { x: number; y: number }> = {
  SP: { x: 58, y: 63 },
  PR: { x: 53, y: 72 },
  SC: { x: 54, y: 77 },
  RS: { x: 48, y: 86 },
  RJ: { x: 66, y: 65 },
  MG: { x: 60, y: 54 },
  GO: { x: 49, y: 47 },
  BA: { x: 71, y: 42 },
  PE: { x: 79, y: 31 },
  CE: { x: 73, y: 24 },
  AM: { x: 28, y: 25 },
};

function getPin(prospect: Prospect) {
  const key = `${prospect.city}-${prospect.state}`.toLowerCase();
  return cityPins[key] ?? stateFallback[prospect.state.toUpperCase()] ?? { x: 56, y: 60 };
}

function ProspectMap({ prospects }: { prospects: Prospect[] }) {
  const visible = prospects.slice(0, 28);

  return (
    <div className="map-panel">
      <div className="section-title">
        <h3>Mapa de prospecção</h3>
        <span>{visible.length} contas no radar</span>
      </div>
      <div className="map-canvas" aria-label="Mapa aproximado de prospecção">
        <svg viewBox="0 0 100 100" role="img" aria-label="Mapa estilizado do Brasil">
          <path
            d="M26 12 L43 8 L58 14 L74 25 L83 41 L76 58 L68 67 L61 82 L48 91 L37 84 L30 70 L21 61 L15 47 L20 33 Z"
            className="map-shape"
          />
          <path d="M50 34 L62 42 L59 58 L48 64 L40 55 L42 42 Z" className="map-highlight" />
        </svg>
        {visible.map((prospect) => {
          const pin = getPin(prospect);
          return (
            <span
              className={cn("map-pin", prospect.status)}
              key={prospect.id}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              title={`${prospect.name} - ${prospect.city}/${prospect.state}`}
            />
          );
        })}
      </div>
      <div className="legend-row">
        <span>
          <i className="legend-dot novo" /> Novo
        </span>
        <span>
          <i className="legend-dot qualificar" /> Qualificar
        </span>
        <span>
          <i className="legend-dot contatar" /> Contatar
        </span>
        <span>
          <i className="legend-dot proposta" /> Proposta
        </span>
      </div>
    </div>
  );
}

function SpreadsheetPanel({ onSendToChat }: { onSendToChat: (prompt: string) => void }) {
  const [grid, setGrid] = useState<string[][]>(() =>
    Array.from({ length: 12 }, (_, rowIndex) =>
      Array.from(
        { length: 6 },
        (_, columnIndex) => (rowIndex === 0 ? ["Empresa", "Cidade", "Produto", "Qtd.", "Valor", "Status"][columnIndex] : "") ?? "",
      ),
    ),
  );
  const [fileName, setFileName] = useState("nova-planilha");
  const [selectedCell, setSelectedCell] = useState({ row: 0, column: 0 });
  const [error, setError] = useState("");

  function updateCell(row: number, column: number, value: string) {
    setGrid(grid.map((line, rowIndex) => (rowIndex === row ? line.map((cell, columnIndex) => (columnIndex === column ? value : cell)) : line)));
  }

  function addRow() {
    setGrid([...grid, Array.from({ length: grid[0]?.length ?? 6 }, () => "")]);
  }

  function addColumn() {
    setGrid(grid.map((row) => [...row, ""]));
  }

  function deleteSelectedRow() {
    if (grid.length <= 1) {
      return;
    }

    setGrid(grid.filter((_, rowIndex) => rowIndex !== selectedCell.row));
    setSelectedCell({ row: 0, column: selectedCell.column });
  }

  function deleteSelectedColumn() {
    if ((grid[0]?.length ?? 0) <= 1) {
      return;
    }

    setGrid(grid.map((row) => row.filter((_, columnIndex) => columnIndex !== selectedCell.column)));
    setSelectedCell({ row: selectedCell.row, column: 0 });
  }

  async function importSheet(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: "" });
      const maxColumns = Math.max(...rows.map((row) => row.length), 6);
      const normalized = rows.length
        ? rows.map((row) => Array.from({ length: maxColumns }, (_, index) => String(row[index] ?? "")))
        : [["Empresa", "Cidade", "Produto", "Qtd.", "Valor", "Status"]];

      setGrid(normalized);
      setFileName(file.name.replace(/\.(xlsx|xls|csv)$/i, ""));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao importar planilha.");
    } finally {
      event.target.value = "";
    }
  }

  async function exportSheet() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet(grid);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ESB-HUNTER");
    XLSX.writeFile(workbook, `${fileName || "esb-hunter-planilha"}.xlsx`);
  }

  function sendSummary() {
    const preview = grid
      .slice(0, 12)
      .map((row) => row.join("; "))
      .join("\n");

    onSendToChat(`Analise esta planilha comercial e sugira ações para o time ESBLight:\n\n${preview}`);
  }

  return (
    <section className="sheet-panel">
      <div className="sheet-toolbar">
        <label>
          Nome
          <input value={fileName} onChange={(event) => setFileName(event.target.value)} />
        </label>
        <label className="compact-file">
          <Upload size={16} aria-hidden="true" />
          Importar
          <input type="file" accept=".xlsx,.xls,.csv" onChange={importSheet} />
        </label>
        <button className="ghost-button" type="button" onClick={addRow}>
          <Rows3 size={16} aria-hidden="true" />
          Linha
        </button>
        <button className="ghost-button" type="button" onClick={addColumn}>
          <Columns3 size={16} aria-hidden="true" />
          Coluna
        </button>
        <button className="ghost-button danger" type="button" onClick={deleteSelectedRow}>
          <Trash2 size={16} aria-hidden="true" />
          Linha
        </button>
        <button className="ghost-button danger" type="button" onClick={deleteSelectedColumn}>
          <Trash2 size={16} aria-hidden="true" />
          Coluna
        </button>
        <button className="ghost-button" type="button" onClick={sendSummary}>
          <ClipboardCheck size={16} aria-hidden="true" />
          Analisar
        </button>
        <button className="primary-button" type="button" onClick={exportSheet}>
          <Download size={16} aria-hidden="true" />
          Exportar XLSX
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="sheet-scroll">
        <table className="sheet-table">
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                <th>{rowIndex + 1}</th>
                {row.map((cell, columnIndex) => (
                  <td key={`cell-${rowIndex}-${columnIndex}`}>
                    <input
                      className={cn(selectedCell.row === rowIndex && selectedCell.column === columnIndex && "selected")}
                      value={cell}
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      onFocus={() => setSelectedCell({ row: rowIndex, column: columnIndex })}
                      aria-label={`Linha ${rowIndex + 1}, coluna ${columnIndex + 1}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sheet-footnote">
        Células iniciadas com <code>=</code> são exportadas para o Excel como conteúdo da célula para edição posterior.
      </p>
    </section>
  );
}
