"use client";

/* eslint-disable @next/next/no-img-element -- Map tiles are external slippy-map images positioned manually. */

import { type PointerEvent, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import {
  AlertCircle,
  Building2,
  Clock3,
  Database,
  Download,
  Filter,
  type LucideIcon,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Search,
  Save,
  Trash2,
  Users,
  WifiOff,
  Wrench,
} from "lucide-react";
import rawProspectData from "@/data/prospect-leads.json";
import type { CatalogChannel, CrmRecord, FollowUpChannel, QualificationStatus } from "@/lib/prospect-crm-types";
import { cn } from "@/lib/utils";

type StorageMode = "loading" | "central" | "local" | "error";

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

function getRecordTime(record?: CrmRecord) {
  if (!record?.updatedAt) {
    return 0;
  }

  const time = Date.parse(record.updatedAt);
  return Number.isFinite(time) ? time : 0;
}

function mergeRecordMaps(serverRecords: Record<string, CrmRecord>, localRecords: Record<string, CrmRecord>) {
  const merged = { ...serverRecords };

  for (const [leadId, localRecord] of Object.entries(localRecords)) {
    if (getRecordTime(localRecord) > getRecordTime(merged[leadId])) {
      merged[leadId] = localRecord;
    }
  }

  return merged;
}

function findLocalRecordsToSync(serverRecords: Record<string, CrmRecord>, localRecords: Record<string, CrmRecord>) {
  return Object.values(localRecords).filter(
    (record) => record.updatedAt && getRecordTime(record) > getRecordTime(serverRecords[record.leadId]),
  );
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

const TILE_SIZE = 256;
const MIN_ZOOM = 4;
const MAX_ZOOM = 14;
const DEFAULT_MAP_VIEW = { lat: -24.6, lng: -49.6, zoom: 6 };

type MapView = {
  lat: number;
  lng: number;
  zoom: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type LatLng = {
  lat: number;
  lng: number;
};

type MapPoint = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function leadLatLng(lead: ProspectLead): LatLng {
  return {
    lat: clamp(-6.25 - lead.coordinates.y * 0.278, -33.8, 5.2),
    lng: clamp(-68 + lead.coordinates.x * 0.36, -73.9, -34.8),
  };
}

function worldSize(zoom: number) {
  return TILE_SIZE * 2 ** zoom;
}

function projectLatLng({ lat, lng }: LatLng, zoom: number): MapPoint {
  const sinLat = Math.sin((clamp(lat, -85.0511, 85.0511) * Math.PI) / 180);
  const scale = worldSize(zoom);

  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function unprojectPoint({ x, y }: MapPoint, zoom: number): LatLng {
  const scale = worldSize(zoom);
  const lng = (x / scale) * 360 - 180;
  const mercator = Math.PI * (1 - (2 * y) / scale);
  const lat = (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;

  return {
    lat: clamp(lat, -85.0511, 85.0511),
    lng,
  };
}

function fitMapToLeads(leads: ProspectLead[], viewport: ViewportSize): MapView {
  if (!leads.length) {
    return DEFAULT_MAP_VIEW;
  }

  const points = leads.map((lead) => projectLatLng(leadLatLng(lead), 0));
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const boundsWidth = Math.max(maxX - minX, 0.0001);
  const boundsHeight = Math.max(maxY - minY, 0.0001);
  const usableWidth = Math.max(viewport.width - 90, 280);
  const usableHeight = Math.max(viewport.height - 90, 220);
  const zoom = clamp(Math.floor(Math.log2(Math.min(usableWidth / boundsWidth, usableHeight / boundsHeight))), MIN_ZOOM, MAX_ZOOM);
  const center = unprojectPoint({ x: (minX + maxX) / 2 * 2 ** zoom, y: (minY + maxY) / 2 * 2 ** zoom }, zoom);

  return {
    ...center,
    zoom,
  };
}

function tileUrl(x: number, y: number, zoom: number) {
  const tileCount = 2 ** zoom;
  const wrappedX = ((x % tileCount) + tileCount) % tileCount;
  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
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
  const [storageMode, setStorageMode] = useState<StorageMode>("loading");
  const [syncMessage, setSyncMessage] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const crmMutationVersionsRef = useRef<Record<string, number>>({});
  const deletedMutationVersionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      const localRecords = readStorage<Record<string, CrmRecord>>("esb-hunter:crm-records", {});
      setCrmRecords(localRecords);
      setIsHydrated(true);

      void (async () => {
        try {
          const response = await fetch("/api/prospect-crm", { cache: "no-store" });
          const payload = (await response.json()) as {
            storage?: StorageMode;
            records?: Record<string, CrmRecord>;
            message?: string;
            error?: string;
          };

          if (!isMounted) {
            return;
          }

          if (!response.ok) {
            throw new Error(payload.error ?? "Falha ao conectar o banco central.");
          }

          if (payload.storage === "central") {
            const serverRecords = payload.records ?? {};
            const recordsToSync = findLocalRecordsToSync(serverRecords, localRecords);
            setCrmRecords(mergeRecordMaps(serverRecords, localRecords));
            setStorageMode("central");
            setSyncMessage(recordsToSync.length ? "Sincronizando registros locais com o banco central." : "");

            for (const record of recordsToSync) {
              const syncResponse = await fetch("/api/prospect-crm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ record }),
              });
              const syncPayload = (await syncResponse.json()) as { error?: string };

              if (!syncResponse.ok) {
                throw new Error(syncPayload.error ?? "Falha ao sincronizar registros locais.");
              }
            }

            if (isMounted) {
              setSyncMessage("");
            }

            return;
          }

          setStorageMode("local");
          setSyncMessage(payload.message ?? "Banco central ainda não configurado. Usando backup local.");
        } catch (caught) {
          if (!isMounted) {
            return;
          }

          setStorageMode("error");
          setSyncMessage(caught instanceof Error ? caught.message : "Falha ao conectar o banco central.");
        }
      })();
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

  function nextCrmMutationVersion(leadId: string) {
    const nextVersion = (crmMutationVersionsRef.current[leadId] ?? 0) + 1;
    crmMutationVersionsRef.current[leadId] = nextVersion;
    return nextVersion;
  }

  async function saveRecordToServer(record: CrmRecord, updateLocalFromServer = true, mutationVersion?: number) {
    try {
      const response = await fetch("/api/prospect-crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record }),
      });
      const payload = (await response.json()) as {
        storage?: StorageMode;
        record?: CrmRecord;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao salvar no banco central.");
      }

      if (payload.storage === "central" && payload.record) {
        const savedLeadId = payload.record.leadId;
        const currentVersion = crmMutationVersionsRef.current[savedLeadId];

        if (mutationVersion !== undefined && currentVersion !== mutationVersion) {
          if (deletedMutationVersionsRef.current[savedLeadId] === currentVersion) {
            void deleteRecordFromServer(savedLeadId, currentVersion);
          }

          return;
        }

        setStorageMode("central");
        setSyncMessage("");

        if (updateLocalFromServer) {
          setCrmRecords((current) => ({
            ...current,
            [payload.record!.leadId]: payload.record!,
          }));
        }
      }
    } catch (caught) {
      setStorageMode((current) => (current === "central" ? "error" : current));
      setSyncMessage(caught instanceof Error ? caught.message : "Falha ao salvar no banco central.");
    }
  }

  async function deleteRecordFromServer(leadId: string, mutationVersion?: number) {
    try {
      const response = await fetch(`/api/prospect-crm/${encodeURIComponent(leadId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { storage?: StorageMode; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Falha ao apagar no banco central.");
      }

      if (payload.storage === "central") {
        if (mutationVersion !== undefined && crmMutationVersionsRef.current[leadId] !== mutationVersion) {
          return;
        }

        setStorageMode("central");
        setSyncMessage("");
      }
    } catch (caught) {
      setStorageMode((current) => (current === "central" ? "error" : current));
      setSyncMessage(caught instanceof Error ? caught.message : "Falha ao apagar no banco central.");
    }
  }

  function updateRecord(leadId: string, patch: Partial<CrmRecord>) {
    let nextRecord: CrmRecord | null = null;
    const mutationVersion = nextCrmMutationVersion(leadId);
    delete deletedMutationVersionsRef.current[leadId];

    setCrmRecords((current) => {
      const lead = prospectData.leads.find((item) => item.id === leadId);
      const previous = lead ? getRecord(lead, current, username) : emptyRecord(leadId, username);
      nextRecord = {
        ...previous,
        ...patch,
        leadId,
        updatedAt: new Date().toISOString(),
        updatedBy: username,
      };

      return {
        ...current,
        [leadId]: nextRecord,
      };
    });

    queueMicrotask(() => {
      if (nextRecord) {
        void saveRecordToServer(nextRecord, true, mutationVersion);
      }
    });
  }

  function deleteRecord(leadId: string) {
    const mutationVersion = nextCrmMutationVersion(leadId);
    deletedMutationVersionsRef.current[leadId] = mutationVersion;

    setCrmRecords((current) => {
      const nextRecords = { ...current };
      delete nextRecords[leadId];
      return nextRecords;
    });
    void deleteRecordFromServer(leadId, mutationVersion);
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

      <div className={cn("crm-sync-banner", storageMode)}>
        {storageMode === "central" ? <Database size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}
        <span>
          {storageMode === "central"
            ? syncMessage || "Banco central ativo. Os atendimentos ficam disponíveis para todos os usuários."
            : syncMessage || "Conectando ao banco central..."}
        </span>
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
          storageMode={storageMode}
          onUpdate={(patch) => selectedLead && updateRecord(selectedLead.id, patch)}
          onDelete={() => selectedLead && deleteRecord(selectedLead.id)}
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
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startCenter: MapPoint;
  } | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 760, height: 430 });
  const [view, setView] = useState<MapView>(DEFAULT_MAP_VIEW);
  const fitKey = leads.map((lead) => lead.id).join("|");

  useEffect(() => {
    const element = mapRef.current;

    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewport({
        width: Math.max(rect.width, 320),
        height: Math.max(rect.height, 280),
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    updateSize();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nextViewport = { width: viewport.width, height: viewport.height };
    queueMicrotask(() => setView(fitMapToLeads(leads, nextViewport)));
  }, [fitKey, leads, viewport.height, viewport.width]);

  const centerPoint = projectLatLng(view, view.zoom);
  const topLeft = {
    x: centerPoint.x - viewport.width / 2,
    y: centerPoint.y - viewport.height / 2,
  };
  const tileCount = 2 ** view.zoom;
  const minTileX = Math.floor(topLeft.x / TILE_SIZE) - 1;
  const maxTileX = Math.floor((topLeft.x + viewport.width) / TILE_SIZE) + 1;
  const minTileY = clamp(Math.floor(topLeft.y / TILE_SIZE) - 1, 0, tileCount - 1);
  const maxTileY = clamp(Math.floor((topLeft.y + viewport.height) / TILE_SIZE) + 1, 0, tileCount - 1);
  const tiles = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      tiles.push({
        key: `${view.zoom}-${x}-${y}`,
        url: tileUrl(x, y, view.zoom),
        left: x * TILE_SIZE - topLeft.x,
        top: y * TILE_SIZE - topLeft.y,
      });
    }
  }

  function zoomBy(delta: number) {
    setView((current) => ({
      ...current,
      zoom: clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenter: projectLatLng(view, view.zoom),
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextCenter = {
      x: drag.startCenter.x - (event.clientX - drag.startX),
      y: drag.startCenter.y - (event.clientY - drag.startY),
    };

    setView((current) => ({
      ...unprojectPoint(nextCenter, current.zoom),
      zoom: current.zoom,
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? -1 : 1);
  }

  return (
    <div className="map-panel prospect-map-panel">
      <div className="section-title">
        <h3>Mapa de prospecção</h3>
        <span>{leads.length} leads visíveis</span>
      </div>
      <div
        ref={mapRef}
        className="tile-map prospect-map-canvas"
        aria-label="Mapa dinâmico de leads por cidade"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerCancel={handlePointerUp}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="tile-layer" aria-hidden="true">
          {tiles.map((tile) => (
            <img alt="" draggable={false} key={tile.key} src={tile.url} style={{ left: tile.left, top: tile.top }} />
          ))}
        </div>
        {leads.map((lead) => {
          const record = getRecord(lead, records, username);
          const position = projectLatLng(leadLatLng(lead), view.zoom);
          const left = position.x - topLeft.x;
          const top = position.y - topLeft.y;

          return (
            <button
              aria-label={`${lead.companyName}, ${lead.city}/${lead.state}`}
              className={cn("map-pin tile-map-pin", record.status, selectedLeadId === lead.id && "selected")}
              key={lead.id}
              style={{ left, top }}
              title={`${lead.companyName} - ${lead.city}/${lead.state}`}
              type="button"
              onClick={() => onSelect(lead.id)}
            />
          );
        })}
        <div className="map-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button aria-label="Aproximar mapa" type="button" onClick={() => zoomBy(1)}>
            +
          </button>
          <button aria-label="Afastar mapa" type="button" onClick={() => zoomBy(-1)}>
            -
          </button>
          <button aria-label="Reajustar enquadramento" type="button" onClick={() => setView(fitMapToLeads(leads, viewport))}>
            Ajustar
          </button>
        </div>
        <div className="map-attribution">&copy; OpenStreetMap</div>
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
  storageMode,
  onUpdate,
  onDelete,
  onSendToChat,
  onExport,
}: {
  lead?: ProspectLead;
  record: CrmRecord | null;
  storageMode: StorageMode;
  onUpdate: (patch: Partial<CrmRecord>) => void;
  onDelete: () => void;
  onSendToChat: (prompt: string) => void;
  onExport: () => void;
}) {
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  if (!lead || !record) {
    return (
      <aside className="crm-panel">
        <p className="empty-state">Selecione um lead no mapa ou na lista para abrir o CRM.</p>
      </aside>
    );
  }

  const hasManualRecord = Boolean(record.updatedAt);
  const isEditing = editingLeadId === lead.id;
  const saveLabel = storageMode === "central" ? "Salvo no banco central" : "Salvo neste navegador";

  function handleDelete() {
    const confirmed = window.confirm("Apagar os dados de atendimento deste lead?");

    if (!confirmed) {
      return;
    }

    onDelete();
    setEditingLeadId(null);
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

      <div className="crm-edit-bar">
        <span>{hasManualRecord ? saveLabel : "Sem edição manual"}</span>
        <div>
          <button className="ghost-button" type="button" onClick={() => setEditingLeadId(isEditing ? null : lead.id)}>
            {isEditing ? <Save size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
            {isEditing ? "Concluir" : "Editar"}
          </button>
          <button className="ghost-button danger" type="button" onClick={handleDelete} disabled={!hasManualRecord}>
            <Trash2 size={15} aria-hidden="true" />
            Apagar
          </button>
        </div>
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
            <select
              value={record.catalogChannel}
              onChange={(event) => onUpdate({ catalogChannel: event.target.value as CatalogChannel })}
            >
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
            <input
              type="date"
              value={record.followUpDate}
              onChange={(event) => onUpdate({ followUpDate: event.target.value })}
            />
          </label>
          <label>
            Tipo de retorno
            <select
              value={record.followUpChannel}
              onChange={(event) => onUpdate({ followUpChannel: event.target.value as FollowUpChannel })}
            >
              <option value="">Selecionar</option>
              <option value="ligacao">Ligação</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="obra">Obra futura</option>
              <option value="reforma">Reforma futura</option>
            </select>
          </label>
          <label>
            Motivo
            <input
              value={record.followUpReason}
              onChange={(event) => onUpdate({ followUpReason: event.target.value })}
              placeholder="Ex.: reforma prevista no segundo semestre"
            />
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
            <input
              value={record.serviceProviderName}
              onChange={(event) => onUpdate({ serviceProviderName: event.target.value })}
            />
          </label>
          <label>
            Contato da terceirizada
            <input
              value={record.serviceProviderContact}
              onChange={(event) => onUpdate({ serviceProviderContact: event.target.value })}
            />
          </label>
          <label>
            Responsável por compra de luminárias
            <input
              value={record.serviceProviderBuyer}
              onChange={(event) => onUpdate({ serviceProviderBuyer: event.target.value })}
            />
          </label>
          <label>
            Contato do comprador
            <input
              value={record.serviceProviderBuyerContact}
              onChange={(event) => onUpdate({ serviceProviderBuyerContact: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      <div className="crm-section inline-fields">
        <h4>Registro do atendimento</h4>
        <label>
          Resumo da tentativa
          <input
            value={record.attemptSummary}
            onChange={(event) => onUpdate({ attemptSummary: event.target.value })}
            placeholder="Ex.: pediu orçamento, solicitou catálogo..."
          />
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
