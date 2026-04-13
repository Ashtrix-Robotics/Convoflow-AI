/**
 * NavBar — shared top navigation component.
 *
 * Single source of truth for the app header. Every page passes its `active`
 * section so the correct link gets the orange highlight. This eliminates the
 * copy-paste header pattern that caused nav items to go missing on some pages.
 */

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../services/api";
import { supabase } from "../lib/supabase";

type NavSection = "dashboard" | "leads" | "classes" | "admin" | "team";

interface NavBarProps {
  /** Which top-level section is currently active — highlights the nav link. */
  active: NavSection;
  /**
   * Optional back button rendered below the main nav bar.
   * Pass `{ label, to }` for a Link, or `{ label, onClick }` for a button.
   */
  breadcrumb?: { label: string; to?: string; onClick?: () => void };
}

const NAV_ITEMS: { key: NavSection; label: string; to: string }[] = [
  { key: "dashboard", label: "Dashboard", to: "/" },
  { key: "leads", label: "Leads", to: "/leads" },
  { key: "classes", label: "Classes", to: "/admin/classes" },
  { key: "team", label: "Team", to: "/admin/team" },
  { key: "admin", label: "Settings", to: "/admin/settings" },
];

export default function NavBar({ active, breadcrumb }: NavBarProps) {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      api.get("/auth/me").then(
        (r) =>
          r.data as {
            id: string;
            name: string;
            email: string;
            is_active: boolean;
          },
      ),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setProfileOpen(false);
    // Sign out from Supabase session too (if Supabase auth was used)
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    // Only remove auth keys — preserve user preferences (leads view, filters, etc.)
    localStorage.removeItem("access_token");
    navigate("/login");
  };

  const initials = me?.name
    ? me.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const isAdmin =
    me?.email === "admin@convoflow.ai" ||
    me?.name?.toLowerCase().includes("admin");

  return (
    <>
      <header className="bg-[#002147] text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">Convoflow AI</h1>
          <nav className="flex gap-4 text-sm">
            {NAV_ITEMS.map(({ key, label, to }) => (
              <Link
                key={key}
                to={to}
                className={
                  active === key
                    ? "text-orange-400 font-semibold"
                    : "hover:text-orange-300 opacity-70"
                }
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 hover:opacity-80 transition focus:outline-none"
          >
            {/* Avatar circle */}
            <div className="w-8 h-8 rounded-full bg-[#FF6600] flex items-center justify-center text-sm font-bold text-white select-none">
              {initials}
            </div>
            {me && (
              <span className="text-sm hidden sm:block max-w-[140px] truncate">
                {me.name}
              </span>
            )}
            <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 10 6">
              <path
                d="M1 1l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FF6600] flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {me?.name ?? "Loading…"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {me?.email ?? ""}
                    </p>
                    {isAdmin && (
                      <span className="inline-block mt-0.5 text-[10px] font-medium bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  My Profile
                </Link>
                <Link
                  to="/admin/team"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
                    />
                  </svg>
                  Team Management
                </Link>
                <Link
                  to="/admin/classes"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Class Schedule
                </Link>
                <Link
                  to="/admin/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Settings
                </Link>
              </div>

              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Optional breadcrumb bar — shown on detail pages */}
      {breadcrumb && (
        <div className="bg-white border-b border-gray-200 px-6 py-2 text-sm text-gray-500">
          {breadcrumb.to ? (
            <Link
              to={breadcrumb.to}
              className="hover:text-[#FF6600] transition"
            >
              ← {breadcrumb.label}
            </Link>
          ) : (
            <button
              onClick={breadcrumb.onClick}
              className="hover:text-[#FF6600] transition"
            >
              ← {breadcrumb.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
