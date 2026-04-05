# Advanced Pabbly Features

## Path Router

Branch a single workflow into multiple paths based on field conditions — avoids
maintaining separate workflows for "positive" vs. "neutral" vs. "negative" sentiment.

**How to add:**

1. After your trigger, drag in a **Router** step
2. Add a condition per path, e.g.:
   - Path A: `sentiment` **equals** `positive` → send email + HubSpot update
   - Path B: `sentiment` **equals** `negative` → only log to Google Sheets + alert manager
   - Path C: _(default)_ → send email only
3. Each path runs independently — a task is consumed per path that executes

**Convoflow AI use case:** Route `transcription.completed` differently based on call outcome:

- Positive sentiment → nurture email + CRM update + WhatsApp congratulation
- Negative sentiment → escalation Slack alert to manager

---

## Code by Pabbly

Run custom JavaScript or Python directly inside a workflow step. Ideal for transforming
data before passing it to downstream actions.

**Example — format action_items array into readable text:**

```javascript
// Code by Pabbly (JavaScript)
const items = input.action_items; // array from webhook payload
const formatted = items.map((item, i) => `${i + 1}. ${item}`).join("\n");
return { formatted_actions: formatted }; // available as {{formatted_actions}}
```

**Example — compute days until due date:**

```javascript
const due = new Date(input.due_date);
const now = new Date();
const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
return { days_until_due: days };
```

**Python alternative:** Pabbly also supports Python in Code steps — use the same
`input` dict and `return {}` pattern.

---

## Iterator

Loop over an array field and execute action steps once per item — instead of passing
the whole array to one step.

**Convoflow AI use case:** Create one CRM task per action item:

1. Add an **Iterator** step after the trigger
2. Select `action_items` as the array to iterate
3. Add a **HubSpot** (or Salesforce) step inside the loop
4. Map `{{current_item}}` as the task description

Each iteration consumes one action task, so a call with 3 action items = 3 tasks for that step.

---

## Delay

Pause workflow execution for a fixed time before the next step. Useful for staged
follow-up sequences.

**Example:** After sending a summary email, wait 1 hour before sending a WhatsApp follow-up:

1. **Gmail** → send email
2. **Delay** → 1 hour
3. **WhatsApp** → send reminder

Delays don't consume tasks.

---

## AI Assistant

Pabbly's built-in AI step (powered by OpenAI/Claude) can summarize, classify, or
rewrite text without writing code.

**Convoflow AI use case:** Re-summarize the `summary` field into a shorter 1-sentence
version for a WhatsApp message character limit:

- **Prompt**: `Summarize this call note in one sentence for a WhatsApp message: {{summary}}`
- **Output**: Available as `{{ai_response}}` in the next step

This is a quick alternative to Code by Pabbly for simple text transformations.

---

## MCP Servers (Pabbly)

Pabbly supports connecting MCP (Model Context Protocol) servers as workflow steps —
allowing AI models to interact with your Pabbly workflows.

Relevant if you are building an AI agent that needs to programmatically trigger or
inspect Pabbly workflows. See the Pabbly docs for MCP server connection details.
