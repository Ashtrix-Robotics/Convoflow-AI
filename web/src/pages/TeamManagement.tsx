import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import NavBar from "../components/NavBar";
import { TeamSkeleton } from "../components/Skeleton";
import api from "../services/api";

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [editAgent, setEditAgent] = useState<any>(null);

  const {
    data: agents,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await api.get("/agents/");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post("/agents/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setShowAdd(false);
      setNewAgent({ name: "", email: "", password: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => api.put(`/agents/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setEditAgent(null);
    },
  });

  // Deactivate instead of hard delete to preserve foreign keys
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) =>
      api.put(`/agents/${id}`, { is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/agents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });

  const handleDelete = (agent: any) => {
    if (
      window.confirm(
        `Permanently delete "${agent.name}"? This cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(agent.id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavBar active="team" />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8 flex-1">
        <header className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-[#002147]">
              Team Management
            </h2>
            <p className="text-sm text-gray-500">
              Manage sales agents, access, and passwords.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-[#FF6600] text-white px-4 py-2 rounded shadow hover:bg-orange-600"
          >
            + Add Agent
          </button>
        </header>

        {showAdd && (
          <div className="bg-white p-6 rounded-xl shadow border border-gray-100 space-y-4">
            <h3 className="font-semibold text-lg">Create New Sales Agent</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Full Name"
                value={newAgent.name}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, name: e.target.value })
                }
                className="border p-2 rounded"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newAgent.email}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, email: e.target.value })
                }
                className="border p-2 rounded"
              />
              <input
                type="password"
                placeholder="Password"
                value={newAgent.password}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, password: e.target.value })
                }
                className="border p-2 rounded"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createMutation.mutate(newAgent)}
                className="bg-green-600 text-white px-4 py-2 rounded"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create User"}
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-500 underline px-2"
              >
                Cancel
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-red-500 text-sm">Error creating agent.</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          {isLoading ? (
            <TeamSkeleton />
          ) : isError ? (
            <p className="p-8 text-center text-red-500">
              Failed to load agents. The backend may still be deploying —
              refresh in a moment.
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/50">
                  <th className="p-4 border-b font-semibold text-sm">Name</th>
                  <th className="p-4 border-b font-semibold text-sm">Email</th>
                  <th className="p-4 border-b font-semibold text-sm">Status</th>
                  <th className="p-4 border-b font-semibold text-sm text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents?.map((agent: any) => (
                  <tr
                    key={agent.id}
                    className="hover:bg-gray-50 transition border-b last:border-0"
                  >
                    <td className="p-4">{agent.name}</td>
                    <td className="p-4 text-gray-600">{agent.email}</td>
                    <td className="p-4">
                      {agent.is_active !== false ? (
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">
                          Active
                        </span>
                      ) : (
                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setEditAgent(agent)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      {agent.is_active !== false && (
                        <button
                          onClick={() => deactivateMutation.mutate(agent.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Suspend
                        </button>
                      )}
                      {agent.is_active === false && (
                        <button
                          onClick={() =>
                            updateMutation.mutate({
                              id: agent.id,
                              data: { is_active: true },
                            })
                          }
                          className="text-green-600 hover:underline text-sm"
                        >
                          Re-activate
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(agent)}
                        disabled={deleteMutation.isPending}
                        className="text-gray-400 hover:text-red-700 text-sm ml-1"
                        title="Permanently delete"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editAgent && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 px-4">
            <div className="bg-white p-6 rounded shadow max-w-md w-full space-y-4">
              <h3 className="font-bold text-lg">
                Edit Agent: {editAgent.name}
              </h3>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full border p-2 rounded"
                  onChange={(e) =>
                    setEditAgent({ ...editAgent, password: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setEditAgent(null)}
                  className="text-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    updateMutation.mutate({
                      id: editAgent.id,
                      data: { password: editAgent.password || undefined },
                    })
                  }
                  className="bg-[#002147] text-white px-4 py-2 rounded"
                >
                  Save Password
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
