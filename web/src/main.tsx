import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { QUERY_STALE_TIME_MS, QUERY_RETRY_COUNT } from "./config";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30 s — prevents redundant refetches when
      // the user navigates between pages (the pre-existing constant, finally applied).
      staleTime: QUERY_STALE_TIME_MS,
      // Honour the project-wide retry setting defined in config.ts
      retry: QUERY_RETRY_COUNT,
      // Don't silently refetch when the user returns to the browser tab —
      // analytics and leads data is polled explicitly where needed.
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
