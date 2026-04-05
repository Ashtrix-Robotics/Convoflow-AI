import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../services/api";

interface TemplateParam {
  label: string;
  example: string;
  description: string;
}
interface FaqItem {
  question: string;
  answer: string;
}
interface ObjectionItem {
  objection: string;
  handling: string;
}

interface Campaign {
  id: string;
  aisensy_campaign_name: string;
  display_name: string;
  is_active: boolean;
  is_default: boolean;
  template_params_schema: TemplateParam[];
  default_template_params: string[];
  product_name: string | null;
  product_description: string | null;
  key_selling_points: string | null;
  pricing_info: string | null;
  target_audience: string | null;
  tone: string;
  ai_persona_prompt: string | null;
  faq: FaqItem[];
  objections: ObjectionItem[];
  created_at: string;
  updated_at: string;
}

const EMPTY: Omit<Campaign, "id" | "created_at" | "updated_at"> = {
  aisensy_campaign_name: "",
  display_name: "",
  is_active: true,
  is_default: false,
  template_params_schema: [],
  default_template_params: [],
  product_name: "",
  product_description: "",
  key_selling_points: "",
  pricing_info: "",
  target_audience: "",
  tone: "friendly",
  ai_persona_prompt: "",
  faq: [],
  objections: [],
};

// ─── Starter templates (hardcoded in code — no DB seed needed) ────────────────
// These pre-fill the "New Campaign" form so any user can get started quickly.
// Add new templates here; they will appear in the empty-state UI automatically.
const STARTER_TEMPLATES: Array<{
  label: string;
  description: string;
  data: typeof EMPTY;
}> = [
  {
    label: "Ashtrix Summer Camp 2026",
    description:
      "EduTech robotics camp — pre-filled with product info, FAQs & objections",
    data: {
      aisensy_campaign_name: "ashtrix_summer_camp_2026",
      display_name: "Summer Camp 2026 Enquiry",
      is_active: true,
      is_default: true,
      template_params_schema: [
        {
          label: "Parent Name",
          example: "Sreenath",
          description: "Parent or guardian's first name",
        },
      ],
      default_template_params: ["Summer Camp 2026", "Ashtrix Robotics"],
      product_name: "Ashtrix Summer Camp 2026",
      product_description:
        "A 10-day hands-on robotics and coding camp for students aged 8–16. Conducted by expert trainers, the camp covers electronics, programming, drone-building, and AI basics. Students build 5+ real projects and earn an Ashtrix completion certificate.",
      key_selling_points:
        "- 10 days of hands-on robotics & coding\n- Expert-led sessions, batch size ≤ 20\n- 5+ real working projects built per student\n- Ashtrix completion certificate\n- Ages 8–16, no prior experience needed\n- Both weekday and weekend batches available",
      pricing_info:
        "₹3,999 per student (early-bird until May 31). Regular price ₹4,999. Group discount: 3+ siblings or friends get 10% off.",
      target_audience:
        "School students aged 8–16 and their parents. Ideal for children interested in technology, STEM, robotics, or coding.",
      tone: "friendly",
      ai_persona_prompt:
        "You are Aria, a warm and knowledgeable admission counsellor at Ashtrix Robotics. Your goal is to answer questions about the Summer Camp, collect the student's details (name, age, school, grade), and guide parents toward booking a seat. Be encouraging, concise, and always end with a soft call-to-action. Never make up information. If unsure, say you will confirm and ask the parent to call the Ashtrix helpline.",
      faq: [
        {
          question: "What age group is the camp suitable for?",
          answer:
            "The camp is designed for students aged 8 to 16 years. No prior experience in robotics or coding is required.",
        },
        {
          question: "When are the batches?",
          answer:
            "We offer weekday batches (Mon–Fri, 10 AM – 1 PM) and weekend batches (Sat–Sun, 9 AM – 2 PM) starting in June 2026.",
        },
        {
          question: "What will my child build?",
          answer:
            "Students build 5+ projects including a line-following robot, obstacle-avoidance bot, mini-drone frame, and a simple AI image classifier.",
        },
        {
          question: "Is a certificate provided?",
          answer:
            "Yes! Every student who completes the 10-day camp receives an Ashtrix Robotics completion certificate.",
        },
        {
          question: "Is lunch or transport included?",
          answer:
            "Lunch and transport are not included. The camp is held at our Ashtrix campus.",
        },
      ],
      objections: [
        {
          objection: "It's too expensive.",
          handling:
            "The ₹3,999 early-bird price covers all materials, kits, and the certificate. Many parents find it great value for a 10-day skill-building experience. We also accept payment in 2 installments.",
        },
        {
          objection: "My child is too young / too old.",
          handling:
            "We've designed the curriculum to be flexible. 8-year-olds work on simplified projects while 16-year-olds tackle advanced AI modules — every student progresses at the right level.",
        },
        {
          objection: "My child has no prior experience.",
          handling:
            "No experience needed at all! Our trainers start from scratch. Many of our best students had never touched a circuit board before joining.",
        },
        {
          objection: "We're too busy.",
          handling:
            "That's why we offer weekend batches — just 2 days a week for 5 weekends. We can find a schedule that works for your family.",
        },
      ],
    },
  },
  {
    label: "General Sales Outreach",
    description:
      "Generic B2C sales template — customize with your product details",
    data: {
      aisensy_campaign_name: "general_sales_v1",
      display_name: "General Sales Outreach",
      is_active: true,
      is_default: false,
      template_params_schema: [
        {
          label: "Lead Name",
          example: "Priya",
          description: "Lead's first name",
        },
        {
          label: "Product",
          example: "Premium Plan",
          description: "Product or service name",
        },
      ],
      default_template_params: ["there", "our product"],
      product_name: "Your Product Name",
      product_description:
        "A brief description of your product or service. What problem does it solve? How does it help the customer?",
      key_selling_points:
        "- [Key benefit 1]\n- [Key benefit 2]\n- [Key benefit 3]",
      pricing_info: "Starting from ₹X,XXX",
      target_audience: "Describe your ideal customer here",
      tone: "professional",
      ai_persona_prompt:
        "You are a friendly sales assistant. Answer questions about the product clearly and concisely. Help leads understand the benefits and guide them toward making a purchase or booking a demo.",
      faq: [
        {
          question: "How does it work?",
          answer:
            "Replace this with a real answer about how your product works.",
        },
        {
          question: "What's included?",
          answer:
            "Replace this with details about what's included in the offering.",
        },
      ],
      objections: [
        {
          objection: "It's too expensive.",
          handling:
            "Replace with your pricing justification or highlight the value delivered.",
        },
        {
          objection: "I need to think about it.",
          handling:
            "Of course! Can I answer any specific questions to help you decide? We also have a limited-time offer available.",
        },
      ],
    },
  },
];

export default function CampaignKnowledge() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Campaign | typeof EMPTY | null>(null);
  const [saveError, setSaveError] = useState("");

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["admin", "campaigns"],
    queryFn: () => api.get("/admin/campaigns").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY) =>
      api.post("/admin/campaigns", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      setEditing(null);
      setSaveError("");
    },
    onError: (e: any) =>
      setSaveError(e?.response?.data?.detail ?? "Save failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY }) =>
      api.put(`/admin/campaigns/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      setEditing(null);
      setSaveError("");
    },
    onError: (e: any) =>
      setSaveError(e?.response?.data?.detail ?? "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }),
  });

  const form = editing ?? { ...EMPTY };
  const isNew = !("id" in form);

  const patch = (key: string, value: unknown) =>
    setEditing((prev) => ({ ...(prev ?? EMPTY), [key]: value }) as Campaign);

  const handleSave = () => {
    setSaveError("");
    if (!form.aisensy_campaign_name.trim()) {
      setSaveError("AiSensy Campaign Name is required.");
      return;
    }
    if (!form.display_name.trim()) {
      setSaveError("Display Name is required.");
      return;
    }
    if (isNew) createMutation.mutate(form as typeof EMPTY);
    else
      updateMutation.mutate({
        id: (form as Campaign).id,
        data: form as typeof EMPTY,
      });
  };

  const toneOptions = ["friendly", "professional", "casual", "energetic"];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar active="admin" />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Campaign Knowledge Base
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Each campaign tells the AI what to say, what product to promote,
              and how to handle objections.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing({ ...EMPTY });
              setSaveError("");
            }}
            className="bg-[#FF6600] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
          >
            + New Campaign
          </button>
        </div>

        {/* Sub-nav */}
        <div className="flex gap-3">
          <Link
            to="/admin/settings"
            className="px-4 py-2 rounded-lg bg-white border text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            Settings
          </Link>
          <Link
            to="/admin/campaigns"
            className="px-4 py-2 rounded-lg bg-[#002147] text-white text-sm font-medium"
          >
            Campaigns
          </Link>
        </div>

        {/* Campaign list */}
        {isLoading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : campaigns.length === 0 ? (
          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm p-6 text-center border border-dashed border-gray-200">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-gray-700 font-semibold">No campaigns yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Start from a starter template below, or click{" "}
                <strong>+ New Campaign</strong> to build from scratch.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Starter Templates
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {STARTER_TEMPLATES.map((t) => (
                  <div
                    key={t.label}
                    className="bg-white rounded-xl shadow-sm p-5 border border-dashed border-orange-200 flex flex-col gap-3 hover:border-orange-400 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {t.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t.description}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditing({ ...t.data });
                        setSaveError("");
                      }}
                      className="mt-auto self-start text-sm bg-[#FF6600] text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 font-semibold"
                    >
                      Use This Template →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-xl shadow-sm p-5 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">
                      {c.display_name}
                    </span>
                    {c.is_default && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                        Default
                      </span>
                    )}
                    {!c.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    AiSensy name:{" "}
                    <code className="bg-gray-100 px-1 rounded">
                      {c.aisensy_campaign_name}
                    </code>
                    {c.product_name ? ` · ${c.product_name}` : ""}
                    {" · "}
                    <span className="capitalize">{c.tone}</span> tone
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(c);
                      setSaveError("");
                    }}
                    className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${c.display_name}"?`))
                        deleteMutation.mutate(c.id);
                    }}
                    className="text-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Editor modal / panel ── */}
        {editing !== null && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">
                  {isNew
                    ? "New Campaign"
                    : `Edit: ${(editing as Campaign).display_name}`}
                </h3>
                <button
                  onClick={() => setEditing(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {saveError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                    {saveError}
                  </div>
                )}

                {/* Starter template picker — shown only when creating a new campaign */}
                {isNew && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-2">
                      Start from a template
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STARTER_TEMPLATES.map((t) => (
                        <button
                          key={t.label}
                          onClick={() => {
                            setEditing({ ...t.data });
                            setSaveError("");
                          }}
                          className="text-xs bg-white border border-orange-300 text-orange-700 px-3 py-1.5 rounded-full hover:bg-orange-100 font-medium transition-colors"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section: AiSensy connection */}
                <section>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    AiSensy Connection
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        AiSensy Campaign Name{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.aisensy_campaign_name}
                        onChange={(e) =>
                          patch("aisensy_campaign_name", e.target.value)
                        }
                        placeholder="Exact name from AiSensy → Campaigns"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none font-mono"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Must match the campaign name in your AiSensy dashboard
                        exactly (case-sensitive).
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Display Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.display_name}
                        onChange={(e) => patch("display_name", e.target.value)}
                        placeholder="e.g. Summer Camp 2026 Enquiry"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={(e) => patch("is_active", e.target.checked)}
                          className="w-4 h-4 accent-orange-500"
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={form.is_default}
                          onChange={(e) =>
                            patch("is_default", e.target.checked)
                          }
                          className="w-4 h-4 accent-orange-500"
                        />
                        Set as Default (auto mode will use this)
                      </label>
                    </div>
                  </div>
                </section>

                {/* Section: Template params */}
                <section>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Template Variables
                  </h4>
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Default parameter values{" "}
                      <span className="text-gray-400">
                        (comma-separated, e.g. name,product)
                      </span>
                    </label>
                    <input
                      value={form.default_template_params.join(",")}
                      onChange={(e) =>
                        patch(
                          "default_template_params",
                          e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="e.g. Summer Camp,Ashtrix,June 2026"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      These fill in <code>{"{{1}}"}</code>,{" "}
                      <code>{"{{2}}"}</code> … in the WhatsApp template in
                      order.
                    </p>
                  </div>
                </section>

                {/* Section: Product knowledge */}
                <section>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Product / Service Knowledge
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Product / Service Name
                      </label>
                      <input
                        value={form.product_name ?? ""}
                        onChange={(e) => patch("product_name", e.target.value)}
                        placeholder="e.g. Ashtrix Summer Camp 2026"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        value={form.product_description ?? ""}
                        onChange={(e) =>
                          patch("product_description", e.target.value)
                        }
                        rows={3}
                        placeholder="Brief description of the product/programme…"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Key Selling Points
                      </label>
                      <textarea
                        value={form.key_selling_points ?? ""}
                        onChange={(e) =>
                          patch("key_selling_points", e.target.value)
                        }
                        rows={3}
                        placeholder="- Hands-on robotics projects&#10;- Expert trainers&#10;- Certificate on completion"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Pricing Info
                      </label>
                      <input
                        value={form.pricing_info ?? ""}
                        onChange={(e) => patch("pricing_info", e.target.value)}
                        placeholder="e.g. ₹3,999 for 10-day camp"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Target Audience
                      </label>
                      <input
                        value={form.target_audience ?? ""}
                        onChange={(e) =>
                          patch("target_audience", e.target.value)
                        }
                        placeholder="e.g. Students aged 8–16 and their parents"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Section: AI Persona */}
                <section>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    AI Persona &amp; Tone
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        Conversation Tone
                      </label>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {toneOptions.map((t) => (
                          <button
                            key={t}
                            onClick={() => patch("tone", t)}
                            className={`px-4 py-1.5 rounded-full text-sm capitalize border font-medium transition-colors ${form.tone === t ? "bg-[#002147] text-white border-[#002147]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">
                        AI System Instructions{" "}
                        <span className="text-gray-400">(optional)</span>
                      </label>
                      <textarea
                        value={form.ai_persona_prompt ?? ""}
                        onChange={(e) =>
                          patch("ai_persona_prompt", e.target.value)
                        }
                        rows={3}
                        placeholder="You are a helpful admission counsellor at Ashtrix Robotics. Always be warm and encouraging…"
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Section: FAQ */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      FAQ
                    </h4>
                    <button
                      onClick={() =>
                        patch("faq", [
                          ...form.faq,
                          { question: "", answer: "" },
                        ])
                      }
                      className="text-xs text-orange-600 font-semibold hover:underline"
                    >
                      + Add Q&amp;A
                    </button>
                  </div>
                  {form.faq.length === 0 && (
                    <p className="text-xs text-gray-400">
                      No FAQs yet. Add common questions leads ask.
                    </p>
                  )}
                  {form.faq.map((item: FaqItem, i: number) => (
                    <div
                      key={i}
                      className="border rounded-lg p-3 mb-2 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          Q {i + 1}
                        </span>
                        <button
                          onClick={() =>
                            patch(
                              "faq",
                              form.faq.filter(
                                (_: FaqItem, j: number) => j !== i,
                              ),
                            )
                          }
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        value={item.question}
                        onChange={(e) => {
                          const f = [...form.faq];
                          f[i] = { ...f[i], question: e.target.value };
                          patch("faq", f);
                        }}
                        placeholder="Question"
                        className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none"
                      />
                      <textarea
                        value={item.answer}
                        onChange={(e) => {
                          const f = [...form.faq];
                          f[i] = { ...f[i], answer: e.target.value };
                          patch("faq", f);
                        }}
                        rows={2}
                        placeholder="Answer"
                        className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none resize-none"
                      />
                    </div>
                  ))}
                </section>

                {/* Section: Objection handling */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Objection Handling
                    </h4>
                    <button
                      onClick={() =>
                        patch("objections", [
                          ...form.objections,
                          { objection: "", handling: "" },
                        ])
                      }
                      className="text-xs text-orange-600 font-semibold hover:underline"
                    >
                      + Add Objection
                    </button>
                  </div>
                  {form.objections.length === 0 && (
                    <p className="text-xs text-gray-400">
                      No objections yet. Add common reasons leads say no.
                    </p>
                  )}
                  {form.objections.map((item: ObjectionItem, i: number) => (
                    <div
                      key={i}
                      className="border rounded-lg p-3 mb-2 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">
                          Objection {i + 1}
                        </span>
                        <button
                          onClick={() =>
                            patch(
                              "objections",
                              form.objections.filter(
                                (_: ObjectionItem, j: number) => j !== i,
                              ),
                            )
                          }
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        value={item.objection}
                        onChange={(e) => {
                          const o = [...form.objections];
                          o[i] = { ...o[i], objection: e.target.value };
                          patch("objections", o);
                        }}
                        placeholder="e.g. Too expensive"
                        className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none"
                      />
                      <textarea
                        value={item.handling}
                        onChange={(e) => {
                          const o = [...form.objections];
                          o[i] = { ...o[i], handling: e.target.value };
                          patch("objections", o);
                        }}
                        rows={2}
                        placeholder="e.g. We offer early-bird pricing and EMI options…"
                        className="w-full border rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none resize-none"
                      />
                    </div>
                  ))}
                </section>
              </div>

              {/* Footer */}
              <div className="p-4 border-t flex justify-end gap-3">
                <button
                  onClick={() => setEditing(null)}
                  className="px-5 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="px-6 py-2 bg-[#FF6600] text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving…"
                    : "Save Campaign"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
