import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import NavBar from "../components/NavBar";
import { TeamSkeleton } from "../components/Skeleton";
import api from "../services/api";

interface Agent {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface EditState {
  id: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AddState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      Suspended
    </span>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  optional = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">
        {label}
        {optional && (
          <span className="font-normal text-gray-400"> (optional)</span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6600]/40 focus:border-[#FF6600]"
      />
    </div>
  );
}

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [addState, setAddState] = useState<AddState>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [editState, setEditState] = useState<EditState | null>(null);
  const [addError, setAddError] = useState("");
  const [editError, setEditError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const {
    data: agents,
    isLoading,
    isError,
  } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await api.get("/agents/");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<AddState, "confirmPassword">) =>
      api.post("/agents/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setShowAdd(false);
      setAddState({ name: "", email: "", password: "", confirmPassword: "" });
      setAddError("");
      flash("Agent created successfully.");
    },
    onError: (err: any) => {
      setAddError(err?.response?.data?.detail ?? "Failed to create agent.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: object }) =>
      api.put(`/agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setEditState(null);
      setEditError("");
      flash("Agent updated successfully.");
    },
    onError: (err: any) => {
      setEditError(err?.response?.data?.detail ?? "Failed to update agent.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setDeleteConfirm(null);
      flash("Agent permanently deleted.");
    },
    onError: (err: any) => {
      setDeleteConfirm(null);
      flash(err?.response?.data?.detail ?? "Failed to delete agent.");
    },
  });

  const handleAddSubmit = () => {
    setAddError("");
    if (!addState.name.trim()) return setAddError("Name is required.");
    if (!addState.email.trim()) return setAddError("Email is required.");
    if (addState.password.length < 8)
      return setAddError("Password must be at least 8 characters.");
    if (addState.password !== addState.confirmPassword)
      return setAddError("Passwords do not match.");
    createMutation.mutate({
      name: addState.name.trim(),
      email: addState.email.trim(),
      password: addState.password,
    });
  };

  const handleEditOpen = (agent: Agent) => {
    setEditState({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      password: "",
      confirmPassword: "",
    });
    setEditError("");
  };

  const handleEditSubmit = () => {
    if (!editState) return;
    setEditError("");
    if (!editState.name.trim()) return setEditError("Name is required.");
    if (!editState.email.trim()) return setEditError("Email is required.");
    if (editState.password) {
      if (editState.password.length < 8)
        return setEditError("Password must be at least 8 characters.");
      if (editState.password !== editState.confirmPassword)
        return setEditError("Passwords do not match.");
    }
    const patch: Record<string, string> = {
      name: editState.name.trim(),
      email: editState.email.trim(),
    };
    if (editState.password) patch.password = editState.password;
    updateMutation.mutate({ id: editState.id, data: patch });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavBar active="team" />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6 flex-1 w-full">
        <header className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-[#002147]">
              Team Management
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Create agents, edit their details, reset passwords, or suspend
              access.
            </p>
          </div>
          <button
            onClick={() => {
              setShowAdd(true);
              setAddError("");
            }}
            className="bg-[#FF6600] text-white px-4 py-2 rounded-lg shadow-sm hover:bg-orange-600 transition text-sm font-semibold"
          >
            + Add Agent
          </button>
        </header>

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-lg">
            {successMsg}
          </div>
        )}

        {/* -- Add Agent form -- */
        {showAdd && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-lg text-[#002147]">
              Create New Sales Agent
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow
                label="Full Name"
                value={addState.name}
                onChange={(v) => setAddState({ ...addState, name: v })}
                placeholder="e.g. Sales Agent 3"
              />
              <FieldRow
                label="Email Address"
                value={addState.email}
                onChange={(v) => setAddState({ ...addState, email: v })}
                type="email"
                placeholder="agent@company.com"
                autoComplete="off"
              />
              <FieldRow
                label="Password"
                value={addState.password}
                onChange={(v) => setAddState({ ...addState, password: v })}
                type="password"
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
              <FieldRow
                label="Confirm Password"
                value={addState.confirmPassword}
                onChange={(v) =>
                  setAddState({ ...addState, confirmPassword: v })
                }
                type="password"
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>
            {addError && <p className="text-red-600 text-sm">{addError}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddSubmit}
                disabled={createMutation.isPending}
                className="bg-[#002147] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-950 disabled:opacity-50 transition"
              >
                {createMutation.isPending ? "Creating..." : "Create Agent"}
              </button>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setAddError("");
                }}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* -- Agents table -- */
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          {isLoading ? (
            <TeamSkeleton />
          ) : isError ? (
            <p className="p-8 text-center text-red-500">
              Failed to load agents. The backend may still be deploying --
              refresh in a moment.
            </p>
          ) : !agents?.length ? (
            <p className="p-8 text-center text-gray-400 italic">
              No agents yet.
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Email
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="hover:bg-gray-50 transition border-b last:border-0"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-800">
                      {agent.name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-sm">
                      {agent.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge active={agent.is_active !== false} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleEditOpen(agent)}
                          className="text-sm text-[#002147] hover:text-[#FF6600] font-medium transition"
                        >
                          Edit
                        </button>
                        {agent.is_active !== false ? (
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: agent.id,
                                data: { is_active: false },
                              })
                            }
                            className="text-sm text-amber-600 hover:text-amber-700 font-medium transition"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              updateMutation.mutate({
                                id: agent.id,
                                data: { is_active: true },
                              })
                            }
                            className="text-sm text-green-600 hover:text-green-700 font-medium transition"
                          >
                            Re-activate
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirm(agent)}
                          className="text-sm text-gray-400 hover:text-red-600 transition"
                          title="Permanently delete"
                        >
                          {"\u{1F5D1}"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* -- Edit Agent Modal -- */
      {editState && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#002147]">Edit Agent</h3>
              <button
                onClick={() => {
                  setEditState(null);
                  setEditError("");
                }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                {"\u00D7"}
              </button>
            </div>

            <div className="space-y-3">
              <FieldRow
                label="Full Name"
                value={editState.name}
                onChange={(v) => setEditState({ ...editState, name: v })}
              />
              <FieldRow
                label="Email Address"
                value={editState.email}
                onChange={(v) => setEditState({ ...editState, email: v })}
                type="email"
                autoComplete="off"
              />
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-3">
                  Leave password fields blank to keep the current password.
                </p>
                <div className="space-y-3">
                  <FieldRow
                    label="New Password"
                    value={editState.password}
                    onChange={(v) =>
                      setEditState({ ...editState, password: v })
                    }
                    type="password"
                    placeholder="Min 8 characters"
                    optional
                    autoComplete="new-password"
                  />
                  <FieldRow
                    label="Confirm New Password"
                    value={editState.confirmPassword}
                    onChange={(v) =>
                      setEditState({ ...editState, confirmPassword: v })
                    }
                    type="password"
                    placeholder="Re-enter new password"
                    optional
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {editError && <p className="text-red-600 text-sm">{editError}</p>}

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setEditState(null);
                  setEditError("");
                }}
                className="text-gray-500 hover:text-gray-700 text-sm px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={updateMutation.isPending}
                className="bg-[#002147] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-blue-950 disabled:opacity-50 transition"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Delete Confirm Modal -- */
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-red-600">Delete Agent?</h3>
            <p className="text-sm text-gray-700">
              Permanently delete <strong>{deleteConfirm.name}</strong> (
              <span className="font-mono text-xs">{deleteConfirm.email}</span>)?{" "}
              This removes their platform account, Supabase login, and all call
              records. Leads they were assigned will become unassigned.
            </p>
            <p className="text-xs text-red-500 font-medium">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="text-gray-500 hover:text-gray-700 text-sm px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
