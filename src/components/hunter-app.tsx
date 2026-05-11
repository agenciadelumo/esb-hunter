/* eslint-disable @next/next/no-img-element -- Catalog previews and generated images are dynamic chat artifacts. */
"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck,
  Columns3,
  Download,
  FileText,
  ImageIcon,
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
import { ProspectingDashboard, prospectTotalLeads } from "@/components/prospecting-dashboard";
import { cn, uid } from "@/lib/utils";

type TabId = "chat" | "prospects" | "files" | "sheets";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  catalogReferences?: CatalogReference[];
  generatedImages?: GeneratedImage[];
};

type UploadedRecord = {
  id: string;
  filename: string;
  status: string;
  bytes: number;
  createdAt: string;
};

type CatalogReference = {
  page: number;
  image: string;
  title: string;
  excerpt: string;
};

type GeneratedImage = {
  src: string;
  label: string;
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

function toPersistableMessages(messages: Message[]) {
  return messages.map((message) => ({
    ...message,
    generatedImages: message.generatedImages?.filter((image) => image.src.length < 50_000),
  }));
}

async function readApiPayload<T extends { error?: string }>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const text = await response.text();

  return {
    error: text.trim() || `Erro HTTP ${response.status}.`,
  } as T;
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

    try {
      window.localStorage.setItem("esb-hunter:messages", JSON.stringify(toPersistableMessages(messages)));
    } catch {
      window.localStorage.setItem("esb-hunter:messages", JSON.stringify(starterMessages));
    }
  }, [isHydrated, messages]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem("esb-hunter:uploads", JSON.stringify(uploads));
  }, [isHydrated, uploads]);

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
      { label: "Leads CRM", value: prospectTotalLeads },
    ],
    [messages, uploads.length],
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
        {activeTab === "prospects" ? <ProspectingDashboard username={username} onSendToChat={sendToChat} /> : null}
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
      const payload = await readApiPayload<{
        message?: string;
        error?: string;
        catalogReferences?: CatalogReference[];
        generatedImages?: GeneratedImage[];
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao consultar o agente.");
      }

      if (!payload.message) {
        throw new Error("O agente respondeu sem mensagem.");
      }

      setMessages([
        ...nextMessages,
        {
          id: uid("msg"),
          role: "assistant",
          content: payload.message,
          createdAt: new Date().toISOString(),
          catalogReferences: payload.catalogReferences ?? [],
          generatedImages: payload.generatedImages ?? [],
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
            {message.generatedImages?.length ? (
              <div className="generated-image-grid" aria-label="Imagens geradas pelo agente">
                {message.generatedImages.map((image, index) => (
                  <a className="generated-image-card" href={image.src} target="_blank" rel="noreferrer" key={`${image.src}-${index}`}>
                    <img src={image.src} alt={image.label} />
                    <span>{image.label}</span>
                  </a>
                ))}
              </div>
            ) : null}
            {message.catalogReferences?.length ? (
              <div className="catalog-reference-grid" aria-label="Referências visuais do catálogo ESBLight">
                {message.catalogReferences.map((reference) => (
                  <a
                    className="catalog-reference-card"
                    href={reference.image}
                    target="_blank"
                    rel="noreferrer"
                    key={reference.page}
                  >
                    <img src={reference.image} alt={`Página ${reference.page} do Catálogo ESBLight 2026`} />
                    <span>Página {reference.page}</span>
                    <strong>{reference.title}</strong>
                    <small>{reference.excerpt}</small>
                  </a>
                ))}
              </div>
            ) : null}
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
        <button
          className="quick-action"
          type="button"
          onClick={() =>
            setDraft(
              "Pesquise concorrentes de iluminação LED industrial no Brasil e compare posicionamento, aplicações e argumentos comerciais com a ESBLight, usando dados públicos.",
            )
          }
        >
          <Search size={16} aria-hidden="true" />
          Pesquisar concorrentes
        </button>
        <button
          className="quick-action"
          type="button"
          onClick={() =>
            setDraft(
              "Consulte o Catálogo ESBLight 2026 e mostre referências visuais para luminárias industriais, incluindo páginas, imagens e QR Codes úteis para apresentar ao cliente.",
            )
          }
        >
          <ImageIcon size={16} aria-hidden="true" />
          Consultar catálogo
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
      const payload = await readApiPayload<{
        error?: string;
        file?: { id: string; filename: string; bytes: number };
        vectorStoreFile?: { status: string };
      }>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha no upload.");
      }

      if (!payload.file || !payload.vectorStoreFile) {
        throw new Error("Upload concluído sem dados do arquivo.");
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
