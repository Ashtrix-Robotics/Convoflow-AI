/**
 * NavBar — shared top navigation component.
 *
 * Single source of truth for the app header. Every page passes its `active`
 * section so the correct link gets the orange highlight. This eliminates the
 * copy-paste header pattern that caused nav items to go missing on some pages.
 */

import { Link, useNavigate } from "react-router-dom";

type NavSection = "dashboard" | "leads" | "admin";

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
  { key: "admin", label: "Admin", to: "/admin/settings" },
];

export default function NavBar({ active, breadcrumb }: NavBarProps) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.clear();
    navigate("/login");
  };

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
        <button
          className="text-sm bg-[#FF6600] px-4 py-2 rounded hover:bg-orange-600"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
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
