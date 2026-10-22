"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Box,
  LayoutDashboard,
  Package,
  ShoppingBag,
  ChartNoAxesCombined,
  Settings2,
  PanelLeftClose,
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  ArrowUpRight,
  ChevronDown,
  X,
} from "lucide-react";
import type { Account } from "@/lib/models";
import { api } from "@/lib/models";
const Context = createContext<Account>({ email: "", manager: false });
export const useAccount = () => useContext(Context);
const links = [
  ["dashboard", "Overview", LayoutDashboard],
  ["inventory", "Inventory", Package],
  ["orders", "Orders", ShoppingBag],
  ["analytics", "Analytics", ChartNoAxesCombined],
  ["settings", "Settings", Settings2],
] as const;
export function AppShell({
  account,
  children,
}: {
  account: Account;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, collapse] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [light, setLight] = useState(false);
  const [notice, setNotice] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const value = localStorage.getItem("logitrack-theme") === "light";
    document.documentElement.classList.toggle("light", value);
    queueMicrotask(() => setLight(value));
    document.documentElement.classList.toggle(
      "reduce-motion",
      localStorage.getItem("logitrack-motion") === "reduced",
    );
  }, []);
  return (
    <Context.Provider value={account}>
      <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
        <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
          <Link className="brand" href="/dashboard">
            <Box size={27} />
            <span>
              LOGITRACK<sup>®</sup>
            </span>
          </Link>
          <button
            className="workspace-switch"
            onClick={() => router.push("/settings")}
          >
            <span className="workspace-avatar">L</span>
            <span>
              Operations workspace
              <small>
                {account.manager ? "Manager access" : "Viewer access"}
              </small>
            </span>
            <ChevronDown size={13} />
          </button>
          <p className="nav-caption">WORKSPACE</p>
          <nav>
            {links.map(([url, label, Icon]) => (
              <Link
                key={url}
                onClick={() => setMobile(false)}
                href={`/${url}`}
                className={path === `/${url}` ? "active" : ""}
                title={label}
              >
                <Icon size={19} />
                <span>{label}</span>
                {path === `/${url}` && <i />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="system-note">
              <span className="status-dot" /> API-backed workspace
              <small>All systems. One perspective.</small>
            </div>
            <button
              onClick={() => collapse(!collapsed)}
              className="collapse-button"
            >
              <PanelLeftClose size={18} />
              <span>Collapse sidebar</span>
            </button>
            <button
              className="profile"
              onClick={() => router.push("/settings")}
            >
              <span className="user-avatar">
                {account.email.charAt(0).toUpperCase()}
              </span>
              <span>
                {account.email.split("@")[0]}
                <small>
                  {account.manager ? "Operations manager" : "Team member"}
                </small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          </div>
        </aside>
        {mobile && (
          <button
            aria-label="Close navigation"
            className="mobile-backdrop"
            onClick={() => setMobile(false)}
          />
        )}
        <div className="main-column">
          <header className="topbar">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <div className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{links.find(([url]) => path === `/${url}`)?.[1]}</strong>
            </div>
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/inventory?q=${encodeURIComponent(query)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Global inventory search"
                placeholder="Search inventory…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="icon-button"
              aria-label="Toggle color theme"
              onClick={() => {
                const v = !light;
                setLight(v);
                document.documentElement.classList.toggle("light", v);
                localStorage.setItem("logitrack-theme", v ? "light" : "dark");
              }}
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label="Notifications"
                aria-expanded={notice}
                onClick={() => setNotice(!notice)}
              >
                <Bell size={18} />
              </button>
              {notice && (
                <div className="notification-panel">
                  <strong>Workspace notifications</strong>
                  <button
                    aria-label="Close notifications"
                    onClick={() => setNotice(false)}
                  >
                    <X size={15} />
                  </button>
                  <p>No notification feed is configured.</p>
                  <small>Low-stock alerts appear in your overview.</small>
                </div>
              )}
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await api("auth/logout", "POST");
                router.replace("/login"); router.refresh();
              }}
            >
              <LogOut size={18} />
            </button>
          </header>
          <main className="page-content">{children}</main>
          <footer className="footer">
            <span>
              <span className="status-dot" /> LOGITRACK COMMAND CENTER
            </span>
            <span>Precision in every movement.</span>
          </footer>
        </div>
      </div>
    </Context.Provider>
  );
}
