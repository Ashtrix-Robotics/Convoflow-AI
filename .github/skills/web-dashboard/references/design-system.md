# Web Dashboard — Design System Reference

Tailwind CSS class patterns and component styles using the Convoflow AI brand colors.

---

## Brand Colors (Tailwind Custom Config)

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#141413",
          light: "#faf9f5",
          orange: "#d97757",
          blue: "#6a9bcc",
          green: "#788c5d",
        },
      },
    },
  },
};
```

Usage: `bg-brand-orange`, `text-brand-dark`, `border-brand-blue`

---

## Status Badge Classes

```tsx
const statusStyles: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  transcribing: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

---

## Sentiment Indicator Classes

```tsx
const sentimentStyles = {
  positive: { dot: "bg-green-500", text: "text-green-700", label: "Positive" },
  neutral: { dot: "bg-gray-400", text: "text-gray-600", label: "Neutral" },
  negative: { dot: "bg-red-500", text: "text-red-700", label: "Negative" },
};

function SentimentIndicator({ sentiment }: { sentiment: string }) {
  const s = sentimentStyles[sentiment as keyof typeof sentimentStyles];
  if (!s) return null;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
```

---

## Card Pattern

```tsx
// Standard content card
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
  {/* content */}
</div>

// Clickable card (call list item)
<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5
                hover:shadow-md hover:border-brand-orange/30 transition-all
                cursor-pointer">
  {/* content */}
</div>

// Stats card
<div className="bg-brand-light rounded-2xl border border-gray-200 p-6 flex flex-col gap-2">
  <span className="text-sm font-medium text-gray-500">Total Calls</span>
  <span className="text-3xl font-bold text-brand-dark">42</span>
</div>
```

---

## Layout Patterns

### Page Container

```tsx
<div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{/* page content */}</div>
```

### Two-Column (Dashboard)

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">{/* main content */}</div>
  <div>{/* sidebar */}</div>
</div>
```

### Stats Row

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {/* 4 stat cards */}
</div>
```

---

## Navigation Bar

```tsx
<nav className="bg-brand-dark text-brand-light px-6 py-4 flex items-center justify-between">
  <span className="text-lg font-bold tracking-tight">Convoflow AI</span>
  <div className="flex items-center gap-4">
    <NavLink
      to="/dashboard"
      className="text-sm hover:text-brand-orange transition-colors"
    >
      Dashboard
    </NavLink>
    <button
      onClick={logout}
      className="text-sm bg-brand-orange text-white px-4 py-2 rounded-lg hover:bg-brand-orange/90 transition-colors"
    >
      Logout
    </button>
  </div>
</nav>
```

---

## Form Controls

```tsx
// Text input
<input
  type="text"
  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm
             focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange
             placeholder:text-gray-400"
/>

// Primary button
<button className="bg-brand-orange text-white px-6 py-2.5 rounded-lg text-sm font-semibold
                   hover:bg-brand-orange/90 active:scale-95 transition-all disabled:opacity-50">
  Submit
</button>

// Secondary button
<button className="border border-gray-200 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-semibold
                   hover:bg-gray-50 transition-colors">
  Cancel
</button>
```

---

## Recharts Brand Colors

```typescript
// Use in all bar/line/pie charts
export const chartColors = {
  primary:   '#6a9bcc',   // brand-blue — main data series
  secondary: '#d97757',   // brand-orange — secondary / accent
  success:   '#788c5d',   // brand-green — positive metrics
  muted:     '#e5e7eb',   // gray-200 — inactive / background bars
};

// Recharts bar example
<Bar dataKey="calls" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
<Bar dataKey="completed" fill={chartColors.success} radius={[4, 4, 0, 0]} />
```

---

## Typography Scale

```
text-xs      = 12px  — badges, captions, timestamps
text-sm      = 14px  — body text, table cells, labels
text-base    = 16px  — default body
text-lg      = 18px  — section headings
text-xl      = 20px  — card titles
text-2xl     = 24px  — page headings
text-3xl     = 30px  — stat numbers
```

Font stack (set in `index.css`):

```css
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap");

body {
  font-family: "Lora", Georgia, serif;
}

h1,
h2,
h3,
h4,
h5,
h6,
.heading {
  font-family: "Poppins", system-ui, sans-serif;
}
```

---

## Loading States

```tsx
// Skeleton card
<div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
  <div className="h-3 bg-gray-100 rounded w-1/2" />
</div>

// Spinner overlay
<div className="flex items-center justify-center py-12">
  <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
</div>
```
