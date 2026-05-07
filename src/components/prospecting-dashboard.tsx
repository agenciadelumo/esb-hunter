"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Clock3,
  Download,
  Filter,
  type LucideIcon,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import rawProspectData from "@/data/prospect-leads.json";
import { cn } from "@/lib/utils";

type QualificationStatus = "none" | "green" | "yellow" | "orange" | "red";
type CatalogChannel = "" | "whatsapp" | "email";
type FollowUpChannel = "" | "ligacao" | "whatsapp" | "obra" | "reforma";

type ProspectDataset = {
  id: string;
  name: string;
  source: string;
  description: string;
};

type ProspectLead = {
  id: string;
  sourceDatasetId: string;
  companyName: string;
  tradeName: string;
  cnpj: string;
  segment: string;
  city: string;
  state: string;
  ibgeCode: string;
  address: string;
  phone: string;
  phoneAlt: string;
  buyerName: string;
  buyerContact: string;
  buyerEmail: string;
  email: string;
  site: string;
  cnae: string;
  cnaeSecondary: string;
  branchInfo: string;
  status: string;
  legalNature: string;
  companySize: string;
  taxRegime: string;
  capital: string;
  partnerNames: string;
  estimatedRevenue: string;
  employees: string;
  debt: string;
  observation: string;
  spreadsheetOutcome: string;
  requiresServiceProviderDiscovery: boolean;
  coordinates: {
    x: number;
    y: number;
  };
};

type ProspectData = {
  generatedAt: string;
  datasets: ProspectDataset[];
  leads: ProspectLead[];
};

type CrmRecord = {
  leadId: string;
  status: QualificationStatus;
  notes: string;
  attemptSummary: string;
  catalogChannel: CatalogChannel;
  followUpDate: string;
  followUpChannel: FollowUpChannel;
  followUpReason: string;
  serviceProviderName: string;
  serviceProviderContact: string;
  serviceProviderBuyer: string;
  serviceProviderBuyerContact: string;
  updatedAt: string;
  updatedBy: string;
};

const prospectData = rawProspectData as ProspectData;

export const prospectTotalLeads = prospectData.leads.length;

const statusOptions: Array<{
  id: QualificationStatus;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "green",
    label: "Verde",
    shortLabel: "Orçamento",
    description: "Atendimento imediato, interesse em comprar e necessita de orçamento.",
  },
  {
    id: "yellow",
    label: "Amarelo",
    shortLabel: "Catálogo",
    description: "Tem interesse no catálogo. Defina envio por WhatsApp ou e-mail.",
  },
  {
    id: "orange",
    label: "Laranja",
    shortLabel: "Retorno",
    description: "Atendimento futuro com data, obra futura, reforma ou retorno combinado.",
  },
  {
    id: "red",
    label: "Vermelho",
    shortLabel: "Sem interesse",
    description: "Não tem interesse no momento.",
  },
];

const emptyRecord = (leadId: string, username: string): CrmRecord => ({
  leadId,
  status: "none",
  notes: "",
  attemptSummary: "",
  catalogChannel: "",
  followUpDate: "",
  followUpChannel: "",
  followUpReason: "",
  serviceProviderName: "",
  serviceProviderContact: "",
  serviceProviderBuyer: "",
  serviceProviderBuyerContact: "",
  updatedAt: "",
  updatedBy: username,
});

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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function statusFromSpreadsheet(value: string): QualificationStatus {
  const normalized = normalize(value);

  if (normalized.includes("nao tem interesse")) {
    return "red";
  }

  if (normalized.includes("agendamento") || normalized.includes("retorno")) {
    return "orange";
  }

  if (normalized.includes("catalogo") && !normalized.includes("orcamento")) {
    return "yellow";
  }

  if (normalized.includes("orcamento")) {
    return "green";
  }

  return "none";
}

function getRecord(lead: ProspectLead, records: Record<string, CrmRecord>, username: string) {
  const stored = records[lead.id];

  if (stored) {
    return stored;
  }

  return {
    ...emptyRecord(lead.id, username),
    status: statusFromSpreadsheet(lead.spreadsheetOutcome),
    attemptSummary: lead.spreadsheetOutcome,
  };
}

function statusLabel(status: QualificationStatus) {
  return statusOptions.find((option) => option.id === status)?.shortLabel ?? "Sem status";
}

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function isDueTodayOrLate(value: string) {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  return due <= today;
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

function leadMatchesSearch(lead: ProspectLead, search: string) {
  if (!search.trim()) {
    return true;
  }

  const haystack = normalize(
    [
      lead.companyName,
      lead.tradeName,
      lead.cnpj,
      lead.city,
      lead.state,
      lead.email,
      lead.phone,
      lead.buyerName,
      lead.buyerContact,
      lead.observation,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return haystack.includes(normalize(search));
}

export function ProspectingDashboard({
  username,
  onSendToChat,
}: {
  username: string;
  onSendToChat: (prompt: string) => void;
}) {
  const [selectedDatasetId, setSelectedDatasetId] = useState(prospectData.datasets[0]?.id ?? "");
  const [cityFilter, setCityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [crmRecords, setCrmRecords] = useState<Record<string, CrmRecord>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      setCrmRecords(readStorage("esb-hunter:crm-records", {}));
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

    window.localStorage.setItem("esb-hunter:crm-records", JSON.stringify(crmRecords));
  }, [crmRecords, isHydrated]);

  const selectedDataset = prospectData.datasets.find((dataset) => dataset.id === selectedDatasetId) ?? prospectData.datasets[0];
  const datasetLeads = useMemo(
    () => prospectData.leads.filter((lead) => lead.sourceDatasetId === selectedDatasetId),
    [selectedDatasetId],
  );
  const cityOptions = useMemo(
    () =>
      Array.from(new Set(datasetLeads.map((lead) => `${lead.city}/${lead.state}`))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [datasetLeads],
  );
  const filteredLeads = useMemo(
    () =>
      datasetLeads
        .filter((lead) => cityFilter === "all" || `${lead.city}/${lead.state}` === cityFilter)
        .filter((lead) => leadMatchesSearch(lead, search))
        .sort((a, b) => a.companyName.localeCompare(b.companyName, "pt-BR")),
    [cityFilter, datasetLeads, search],
  );
  const selectedLead = filteredLeads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? datasetLeads[0];

  useEffect(() => {
    if (!filteredLeads.length) {
      return;
    }

    if (selectedLeadId && filteredLeads.some((lead) => lead.id === selectedLeadId)) {
      return;
    }

    queueMicrotask(() => setSelectedLeadId(filteredLeads[0].id));
  }, [filteredLeads, selectedLeadId]);

  const selectedRecord = selectedLead ? getRecord(selectedLead, crmRecords, username) : null;

  function updateRecord(leadId: string, patch: Partial<CrmRecord>) {
    setCrmRecords((current) => {
      const lead = prospectData.leads.find((item) => item.id === leadId);
      const previous = lead ? getRecord(lead, current, username) : emptyRecord(leadId, username);

      return {
        ...current,
        [leadId]: {
          ...previous,
          ...patch,
          leadId,
          updatedAt: new Date().toISOString(),
          updatedBy: username,
        },
      };
    });
  }

  const dashboard = useMemo(() => {
    const records = datasetLeads.map((lead) => ({ lead, record: getRecord(lead, crmRecords, username) }));
    const opportunities = records.filter(
      ({ record }) => record.status === "green" || (record.status === "orange" && isDueTodayOrLate(record.followUpDate)),
    );
    const pending = records.filter(
      ({ record }) =>
        record.status === "none" ||
        (record.status === "yellow" && !record.catalogChannel) ||
        (record.status === "orange" && !record.followUpDate) ||
        (record.status === "orange" && isDueTodayOrLate(record.followUpDate)),
    );
    const serviceDiscovery = records.filter(
      ({ lead, record }) =>
        lead.requiresServiceProviderDiscovery && (!record.serviceProviderName || !record.serviceProviderBuyerContact),
    );

    return {
      opportunities,
      pending,
      serviceDiscovery,
      qualified: records.filter(({ record }) => record.status !== "none").length,
    };
  }, [crmRecords, datasetLeads, username]);

  return (
    <section className="prospection-dashboard">
      <div className="prospection-kpis">
        <MetricBlock icon={MapPin} label="Leads no filtro" value={datasetLeads.length} />
        <MetricBlock icon={Users} label="Qualificados" value={dashboard.qualified} />
        <MetricBlock icon={Clock3} label="Oportunidades do dia" value={dashboard.opportunities.length} />
        <MetricBlock icon={AlertCircle} label="Pendências" value={dashboard.pending.length} />
      </div>

      <div className="prospection-layout">
        <aside className="prospection-sidebar">
          <div className="section-title">
            <h3>Filtros de prospecção</h3>
            <Filter size={16} aria-hidden="true" />
          </div>

          <label>
            Planilha / lista
            <select value={selectedDatasetId} onChange={(event) => setSelectedDatasetId(event.target.value)}>
              {prospectData.datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Cidade
            <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)}>
              <option value="all">Todas as cidades</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label>
            Pesquisar cliente
            <span className="search-input">
              <Search size={15} aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, cidade, CNPJ, contato..." />
            </span>
          </label>

          <div className="dataset-note">
            <strong>{selectedDataset?.name}</strong>
            <span>{selectedDataset?.description}</span>
          </div>

          <div className="lead-mini-list">
            {filteredLeads.length ? (
              filteredLeads.slice(0, 80).map((lead) => {
                const record = getRecord(lead, crmRecords, username);

                return (
                  <button
                    className={cn("lead-list-item", selectedLead?.id === lead.id && "active", record.status)}
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <strong>{lead.companyName}</strong>
                    <span>
                      {lead.city}/{lead.state} · {statusLabel(record.status)}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="empty-state">Nenhum lead encontrado com os filtros atuais.</p>
            )}
          </div>
        </aside>

        <div className="prospection-map-column">
          <ProspectMap leads={filteredLeads} records={crmRecords} selectedLeadId={selectedLead?.id} username={username} onSelect={setSelectedLeadId} />

          <div className="opportunity-grid">
            <OpportunityBox
              title="Oportunidades do dia"
              empty="Nenhuma oportunidade imediata ou retorno vencido."
              items={dashboard.opportunities.slice(0, 5)}
              onSelect={setSelectedLeadId}
            />
            <OpportunityBox
              title="Pendências"
              empty="Sem pendências neste filtro."
              items={dashboard.pending.slice(0, 5)}
              onSelect={setSelectedLeadId}
            />
          </div>
        </div>

        <LeadCrmPanel
          lead={selectedLead}
          record={selectedRecord}
          onUpdate={(patch) => selectedLead && updateRecord(selectedLead.id, patch)}
          onSendToChat={onSendToChat}
          onExport={() =>
            downloadJson("esb-hunter-crm-prospeccao.json", {
              dataset: selectedDataset,
              exportedAt: new Date().toISOString(),
              records: crmRecords,
            })
          }
        />
      </div>
    </section>
  );
}

function MetricBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="prospection-kpi">
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProspectMap({
  leads,
  records,
  selectedLeadId,
  username,
  onSelect,
}: {
  leads: ProspectLead[];
  records: Record<string, CrmRecord>;
  selectedLeadId?: string;
  username: string;
  onSelect: (leadId: string) => void;
}) {
  return (
    <div className="map-panel prospect-map-panel">
      <div className="section-title">
        <h3>Mapa de prospecção</h3>
        <span>{leads.length} leads visíveis</span>
      </div>
      <div className="map-canvas prospect-map-canvas" aria-label="Mapa de leads por cidade">
        <svg viewBox="0 0 100 100" role="img" aria-label="Mapa estilizado do Brasil">
          <path
            d="M26 12 L43 8 L58 14 L74 25 L83 41 L76 58 L68 67 L61 82 L48 91 L37 84 L30 70 L21 61 L15 47 L20 33 Z"
            className="map-shape"
          />
          <path d="M43 66 L61 59 L67 67 L57 84 L47 91 L38 82 Z" className="map-highlight south" />
          <path d="M55 55 L72 55 L76 61 L66 68 L57 65 Z" className="map-highlight southeast" />
        </svg>
        {leads.map((lead) => {
          const record = getRecord(lead, records, username);

          return (
            <button
              aria-label={`${lead.companyName}, ${lead.city}/${lead.state}`}
              className={cn("map-pin", record.status, selectedLeadId === lead.id && "selected")}
              key={lead.id}
              style={{ left: `${lead.coordinates.x}%`, top: `${lead.coordinates.y}%` }}
              title={`${lead.companyName} - ${lead.city}/${lead.state}`}
              type="button"
              onClick={() => onSelect(lead.id)}
            />
          );
        })}
      </div>
      <div className="legend-row">
        {statusOptions.map((option) => (
          <span key={option.id}>
            <i className={cn("legend-dot", option.id)} /> {option.label}
          </span>
        ))}
        <span>
          <i className="legend-dot none" /> Sem status
        </span>
      </div>
    </div>
  );
}

function OpportunityBox({
  title,
  empty,
  items,
  onSelect,
}: {
  title: string;
  empty: string;
  items: Array<{ lead: ProspectLead; record: CrmRecord }>;
  onSelect: (leadId: string) => void;
}) {
  return (
    <div className="opportunity-box">
      <h3>{title}</h3>
      {items.length ? (
        items.map(({ lead, record }) => (
          <button className={cn("opportunity-item", record.status)} key={lead.id} type="button" onClick={() => onSelect(lead.id)}>
            <strong>{lead.companyName}</strong>
            <span>
              {lead.city}/{lead.state}
              {record.followUpDate ? ` · ${formatDate(record.followUpDate)}` : ""}
            </span>
          </button>
        ))
      ) : (
        <p className="empty-state">{empty}</p>
      )}
    </div>
  );
}

function LeadCrmPanel({
  lead,
  record,
  onUpdate,
  onSendToChat,
  onExport,
}: {
  lead?: ProspectLead;
  record: CrmRecord | null;
  onUpdate: (patch: Partial<CrmRecord>) => void;
  onSendToChat: (prompt: string) => void;
  onExport: () => void;
}) {
  if (!lead || !record) {
    return (
      <aside className="crm-panel">
        <p className="empty-state">Selecione um lead no mapa ou na lista para abrir o CRM.</p>
      </aside>
    );
  }

  return (
    <aside className={cn("crm-panel", record.status)}>
      <div className="crm-header">
        <div>
          <p className="eyebrow">CRM do lead</p>
          <h3>{lead.companyName}</h3>
          <span>
            {lead.city}/{lead.state} · {lead.cnpj}
          </span>
        </div>
        <b className={cn("crm-status-badge", record.status)}>{statusLabel(record.status)}</b>
      </div>

      <div className="lead-facts">
        <Fact icon={Building2} label="Segmento" value={lead.segment} />
        <Fact icon={Phone} label="Telefone" value={lead.phone || lead.phoneAlt || "Não informado"} />
        <Fact icon={Mail} label="E-mail" value={lead.email || "Não informado"} />
        <Fact icon={MapPin} label="Endereço" value={lead.address || "Não informado"} />
      </div>

      <div className="crm-section">
        <h4>Qualificação por cor</h4>
        <div className="qualification-grid">
          {statusOptions.map((option) => (
            <button
              className={cn("qualification-button", option.id, record.status === option.id && "active")}
              key={option.id}
              type="button"
              onClick={() => onUpdate({ status: option.id })}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </div>

      {record.status === "yellow" ? (
        <div className="crm-section inline-fields">
          <h4>Envio de catálogo</h4>
          <label>
            Canal
            <select value={record.catalogChannel} onChange={(event) => onUpdate({ catalogChannel: event.target.value as CatalogChannel })}>
              <option value="">Definir canal</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
            </select>
          </label>
        </div>
      ) : null}

      {record.status === "orange" ? (
        <div className="crm-section inline-fields">
          <h4>Retorno futuro</h4>
          <label>
            Data de retorno
            <input type="date" value={record.followUpDate} onChange={(event) => onUpdate({ followUpDate: event.target.value })} />
          </label>
          <label>
            Tipo de retorno
            <select value={record.followUpChannel} onChange={(event) => onUpdate({ followUpChannel: event.target.value as FollowUpChannel })}>
              <option value="">Selecionar</option>
              <option value="ligacao">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="obra">Obra futura</option>
              <option value="reforma">Reforma futura</option>
            </select>
          </label>
          <label>
            Motivo
            <input value={record.followUpReason} onChange={(event) => onUpdate({ followUpReason: event.target.value })} placeholder="Ex.: reforma prevista no 2º semestre" />
          </label>
        </div>
      ) : null}

      {lead.requiresServiceProviderDiscovery ? (
        <div className="crm-section inline-fields">
          <h4>
            <Wrench size={15} aria-hidden="true" />
            Terceirizada / manutenção
          </h4>
          <label>
            Empresa prestadora de serviços
            <input value={record.serviceProviderName} onChange={(event) => onUpdate({ serviceProviderName: event.target.value })} />
          </label>
          <label>
            Contato da terceirizada
            <input value={record.serviceProviderContact} onChange={(event) => onUpdate({ serviceProviderContact: event.target.value })} />
          </label>
          <label>
            Responsável por compra de luminárias
            <input value={record.serviceProviderBuyer} onChange={(event) => onUpdate({ serviceProviderBuyer: event.target.value })} />
          </label>
          <label>
            Contato do comprador
            <input value={record.serviceProviderBuyerContact} onChange={(event) => onUpdate({ serviceProviderBuyerContact: event.target.value })} />
          </label>
        </div>
      ) : null}

      <div className="crm-section inline-fields">
        <h4>Registro do atendimento</h4>
        <label>
          Resumo da tentativa
          <input value={record.attemptSummary} onChange={(event) => onUpdate({ attemptSummary: event.target.value })} placeholder="Ex.: pediu orçamento, solicitou catálogo..." />
        </label>
        <label>
          Detalhes do atendimento
          <textarea value={record.notes} onChange={(event) => onUpdate({ notes: event.target.value })} rows={5} />
        </label>
        <small>
          {record.updatedAt
            ? `Última atualização por ${record.updatedBy} em ${new Date(record.updatedAt).toLocaleString("pt-BR")}`
            : "Ainda sem registro manual."}
        </small>
      </div>

      <div className="crm-actions">
        <button
          className="ghost-button"
          type="button"
          onClick={() =>
            onSendToChat(
              `Prepare uma abordagem comercial para ${lead.companyName}, em ${lead.city}/${lead.state}. Status CRM: ${statusLabel(record.status)}. Observações: ${record.notes || record.attemptSummary || "sem observações"}.`,
            )
          }
        >
          <MessageSquare size={16} aria-hidden="true" />
          Abordar com agente
        </button>
        <button className="ghost-button" type="button" onClick={onExport}>
          <Download size={16} aria-hidden="true" />
          Exportar CRM
        </button>
      </div>
    </aside>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="lead-fact">
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
