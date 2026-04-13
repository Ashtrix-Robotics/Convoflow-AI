import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import NavBar from "../components/NavBar";
import api from "../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Center {
  id: string;
  name: string;
  address: string | null;
  map_url: string | null;
  mode: string;
  is_active: boolean;
  created_at: string;
}

interface Batch {
  id: string;
  center_id: string;
  label: string;
  start_date: string | null;
  end_date: string | null;
  time_slot: string | null;
  mode: string;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  center_name: string;
  center_mode: string;
}

// ─── Modal helpers ────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Input helpers ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF6600]/30 focus:border-[#FF6600]";

// ─── Center Forms ─────────────────────────────────────────────────────────────

function CenterForm({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Partial<Center>;
  onSave: (data: Partial<Center>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [mapUrl, setMapUrl] = useState(initial?.map_url ?? "");
  const [mode, setMode] = useState(initial?.mode ?? "offline");

  return (
    <div className="flex flex-col gap-4">
      <Field label="Center Name" required>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Medavakkam"
        />
      </Field>
      <Field label="Mode">
        <select
          className={inputCls}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="offline">Offline</option>
          <option value="online">Online</option>
          <option value="hybrid">Hybrid</option>
        </select>
      </Field>
      <Field label="Address">
        <input
          className={inputCls}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Full address (optional)"
        />
      </Field>
      <Field label="Google Maps URL">
        <input
          className={inputCls}
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          placeholder="https://maps.google.com/... (optional)"
        />
      </Field>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onSave({
              name: name.trim(),
              address: address.trim() || null,
              map_url: mapUrl.trim() || null,
              mode,
            })
          }
          disabled={!name.trim() || saving}
          className="flex-1 bg-[#FF6600] text-white text-sm font-medium py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Batch Form ───────────────────────────────────────────────────────────────

function BatchForm({
  centers,
  initial,
  onSave,
  onClose,
  saving,
}: {
  centers: Center[];
  initial?: Partial<Batch>;
  onSave: (data: Partial<Batch>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [centerId, setCenterId] = useState(initial?.center_id ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [timeSlot, setTimeSlot] = useState(initial?.time_slot ?? "");
  const [mode, setMode] = useState(initial?.mode ?? "offline");
  const [capacity, setCapacity] = useState<string>(
    initial?.capacity != null ? String(initial.capacity) : ""
  );

  const isEdit = !!initial?.id;

  return (
    <div className="flex flex-col gap-4">
      {!isEdit && (
        <Field label="Center" required>
          <select
            className={inputCls}
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
          >
            <option value="">— Select center —</option>
            {centers.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.mode})
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Batch Label" required>
        <input
          className={inputCls}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. May 19 – May 30"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Date">
          <input
            type="date"
            className={inputCls}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="End Date">
          <input
            type="date"
            className={inputCls}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Time Slot">
        <input
          className={inputCls}
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value)}
          placeholder="e.g. 4:00 PM – 5:00 PM"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mode">
          <select
            className={inputCls}
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="offline">Offline</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </Field>
        <Field label="Capacity">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="—"
          />
        </Field>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onSave({
              center_id: centerId || undefined,
              label: label.trim(),
              start_date: startDate || null,
              end_date: endDate || null,
              time_slot: timeSlot.trim() || null,
              mode,
              capacity: capacity ? parseInt(capacity) : null,
            })
          }
          disabled={(!isEdit && !centerId) || !label.trim() || saving}
          className="flex-1 bg-[#FF6600] text-white text-sm font-medium py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "centers" | "batches";

export default function ClassManagement() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("centers");

  // Modals
  const [addCenterOpen, setAddCenterOpen] = useState(false);
  const [editCenter, setEditCenter] = useState<Center | null>(null);
  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);

  // Filter batches by center
  const [batchCenterFilter, setBatchCenterFilter] = useState<string>("all");

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: centers = [], isLoading: centersLoading } = useQuery<Center[]>({
    queryKey: ["classes", "centers", "all"],
    queryFn: () =>
      api.get("/classes/centers?include_inactive=true").then((r) => r.data),
  });

  const { data: batches = [], isLoading: batchesLoading } = useQuery<Batch[]>({
    queryKey: ["classes", "batches", "all"],
    queryFn: () =>
      api.get("/classes/batches?include_inactive=true").then((r) => r.data),
  });

  // ── Center mutations ───────────────────────────────────────────────────────

  const createCenter = useMutation({
    mutationFn: (data: Partial<Center>) => api.post("/classes/centers", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      setAddCenterOpen(false);
    },
  });

  const updateCenter = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Center> }) =>
      api.patch(`/classes/centers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      setEditCenter(null);
    },
  });

  // ── Batch mutations ────────────────────────────────────────────────────────

  const createBatch = useMutation({
    mutationFn: (data: Partial<Batch>) => api.post("/classes/batches", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      setAddBatchOpen(false);
    },
  });

  const updateBatch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Batch> }) =>
      api.patch(`/classes/batches/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      setEditBatch(null);
    },
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const filteredBatches =
    batchCenterFilter === "all"
      ? batches
      : batches.filter((b) => b.center_id === batchCenterFilter);

  const activeCenters = centers.filter((c) => c.is_active).length;
  const activeBatches = batches.filter((b) => b.is_active).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar active="classes" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Class Schedule Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage class centers, batch schedules, and session timings.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Centers", value: centers.length, sub: `${activeCenters} active` },
            { label: "Batches", value: batches.length, sub: `${activeBatches} active` },
            {
              label: "Leads Assigned",
              value: "—",
              sub: "across all centers",
            },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {(["centers", "batches"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition ${
                tab === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "centers" ? "Centers" : "Batches"}
            </button>
          ))}
        </div>

        {/* ── CENTERS TAB ── */}
        {tab === "centers" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">
                All Centers
                <span className="ml-2 text-xs text-gray-400">({centers.length})</span>
              </h2>
              <button
                onClick={() => setAddCenterOpen(true)}
                className="flex items-center gap-1.5 bg-[#FF6600] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-orange-600 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Center
              </button>
            </div>

            {centersLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : centers.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No centers yet. Add one above.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {centers.map((center) => {
                  const batchCount = batches.filter((b) => b.center_id === center.id).length;
                  const activeBatchCount = batches.filter(
                    (b) => b.center_id === center.id && b.is_active
                  ).length;
                  return (
                    <div
                      key={center.id}
                      className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition ${!center.is_active ? "opacity-50" : ""}`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          center.mode === "online"
                            ? "bg-blue-50"
                            : center.mode === "hybrid"
                            ? "bg-purple-50"
                            : "bg-orange-50"
                        }`}
                      >
                        {center.mode === "online" ? "💻" : center.mode === "hybrid" ? "🔀" : "🏫"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{center.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                              center.mode === "online"
                                ? "bg-blue-50 text-blue-600"
                                : center.mode === "hybrid"
                                ? "bg-purple-50 text-purple-600"
                                : "bg-orange-50 text-orange-600"
                            }`}
                          >
                            {center.mode}
                          </span>
                          {!center.is_active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase bg-gray-100 text-gray-400">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {center.address || "No address"}
                          {" · "}
                          <span>
                            {activeBatchCount}/{batchCount} active batches
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle active */}
                        <button
                          onClick={() =>
                            updateCenter.mutate({
                              id: center.id,
                              data: { is_active: !center.is_active },
                            })
                          }
                          title={center.is_active ? "Deactivate" : "Activate"}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                            center.is_active
                              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              : "bg-green-50 text-green-600 hover:bg-green-100"
                          }`}
                        >
                          {center.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => setEditCenter(center)}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── BATCHES TAB ── */}
        {tab === "batches" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  All Batches
                  <span className="ml-2 text-xs text-gray-400">({filteredBatches.length})</span>
                </h2>
                {/* Filter by center */}
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FF6600]/30"
                  value={batchCenterFilter}
                  onChange={(e) => setBatchCenterFilter(e.target.value)}
                >
                  <option value="all">All Centers</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setAddBatchOpen(true)}
                className="flex items-center gap-1.5 bg-[#FF6600] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-orange-600 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Batch
              </button>
            </div>

            {batchesLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            ) : filteredBatches.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No batches found.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className={`flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition ${!batch.is_active ? "opacity-50" : ""}`}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 bg-indigo-50">
                      📅
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">
                          {batch.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase bg-blue-50 text-blue-600">
                          {batch.center_name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                            batch.mode === "online"
                              ? "bg-blue-50 text-blue-500"
                              : "bg-orange-50 text-orange-500"
                          }`}
                        >
                          {batch.mode}
                        </span>
                        {!batch.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase bg-gray-100 text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {batch.time_slot ?? "No time slot"}
                        {batch.start_date && (
                          <> · {batch.start_date} → {batch.end_date ?? "?"}</>
                        )}
                        {batch.capacity != null && <> · {batch.capacity} seats</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          updateBatch.mutate({
                            id: batch.id,
                            data: { is_active: !batch.is_active },
                          })
                        }
                        title={batch.is_active ? "Deactivate" : "Activate"}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                          batch.is_active
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-green-50 text-green-600 hover:bg-green-100"
                        }`}
                      >
                        {batch.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => setEditBatch(batch)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {addCenterOpen && (
        <Modal title="Add New Center" onClose={() => setAddCenterOpen(false)}>
          <CenterForm
            onSave={(data) => createCenter.mutate(data)}
            onClose={() => setAddCenterOpen(false)}
            saving={createCenter.isPending}
          />
        </Modal>
      )}

      {editCenter && (
        <Modal title="Edit Center" onClose={() => setEditCenter(null)}>
          <CenterForm
            initial={editCenter}
            onSave={(data) => updateCenter.mutate({ id: editCenter.id, data })}
            onClose={() => setEditCenter(null)}
            saving={updateCenter.isPending}
          />
        </Modal>
      )}

      {addBatchOpen && (
        <Modal title="Add New Batch" onClose={() => setAddBatchOpen(false)}>
          <BatchForm
            centers={centers}
            onSave={(data) => createBatch.mutate(data)}
            onClose={() => setAddBatchOpen(false)}
            saving={createBatch.isPending}
          />
        </Modal>
      )}

      {editBatch && (
        <Modal title="Edit Batch" onClose={() => setEditBatch(null)}>
          <BatchForm
            centers={centers}
            initial={editBatch}
            onSave={(data) => updateBatch.mutate({ id: editBatch.id, data })}
            onClose={() => setEditBatch(null)}
            saving={updateBatch.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
