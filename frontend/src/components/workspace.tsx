"use client";
import { useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Box,
  Plus,
  Search,
  Trash2,
  MapPin,
  RefreshCw,
  X,
  SlidersHorizontal,
  Download,
} from "lucide-react";
import {
  api,
  type Inventory,
  type Order,
  type OrderDetail,
  type OrderedProduct,
} from "@/lib/models";
import { useAccount } from "./app-shell";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { DashboardOverview } from "./dashboard-overview";
import { EmptyState as Empty } from "./empty-state";
import { number, date } from "@/lib/format";
const Charts = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => <div className="chart skeleton" />,
});
export function Workspace({ section }: { section: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const account = useAccount();
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [orderedProducts, setOrderedProducts] = useState<OrderedProduct[]>([]);
  const [analyticsError, setAnalyticsError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState(searchQuery);
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState("");
  const [detail, setDetail] = useState<OrderDetail | Inventory | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; kind: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [days, setDays] = useState("30");
  const [lines, setLines] = useState([{ inventoryItemId: 0, quantity: 1 }]);
  async function load() {
    setError("");
    setLoading(true);
    try {
      const [i, o] = await Promise.all([
        api<Inventory[]>("inventory"),
        api<Order[]>("orders"),
      ]);
      setInventory(i);
      setOrders(o);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load workspace");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    queueMicrotask(() => {
      setQuery(searchQuery);
      setPage(1);
    });
  }, [searchQuery]);
  useEffect(() => {
    if (section !== "analytics" || loading) return;
    let active = true;
    api<OrderedProduct[]>("orders/analytics")
      .then((data) => {
        if (active) {
          setOrderedProducts(data);
          setAnalyticsError("");
        }
      })
      .catch(() => {
        if (active)
          setAnalyticsError(
            "Ordered-product analytics are unavailable. Refresh after checking the API.",
          );
      });
    return () => {
      active = false;
    };
  }, [section, loading]);
  const low = inventory.filter((i) => i.quantity <= 10);
  const distribution = Object.entries(
    inventory.reduce<Record<string, number>>((a, i) => {
      a[i.location] = (a[i.location] || 0) + i.quantity;
      return a;
    }, {}),
  ).map(([name, value]) => ({ name, value }));
  const trend = Object.entries(
    orders
      .filter(
        (o) =>
          now -
            new Date(
              o.datePlaced + "Z".repeat(o.datePlaced.endsWith("Z") ? 0 : 1),
            ).getTime() <=
          Number(days) * 86400000,
      )
      .reduce<Record<string, number>>((a, o) => {
        const d = o.datePlaced.slice(0, 10);
        a[d] = (a[d] || 0) + 1;
        return a;
      }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));
  const filtered = inventory
    .filter(
      (i) =>
        `${i.name} ${i.itemId} ${i.location}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!location || i.location === location),
    )
    .sort((a, b) =>
      sort === "quantity"
        ? a.quantity - b.quantity
        : a.name.localeCompare(b.name),
    );
  const filteredOrders = orders.filter((o) =>
    `${o.customerName} ${o.orderId}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const total = section === "orders" ? filteredOrders.length : filtered.length;
  const pages = Math.max(1, Math.ceil(total / 8));
  const currentPage = Math.min(page, pages);
  function success(message: string) {
    setModal("");
    setDetail(null);
    setDeleting(null);
    setToast(message);
    void load();
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      if (section === "inventory")
        await api("inventory", "POST", {
          name: data.get("name"),
          location: data.get("location"),
          quantity: Number(data.get("quantity")),
        });
      else
        await api("orders", "POST", {
          customerName: data.get("customerName"),
          items: lines,
        });
      success(
        section === "inventory"
          ? "Inventory record created"
          : "Order created. Stock updated.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ inventory, orders }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "logitrack-snapshot.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">OPERATIONS / {section.toUpperCase()}</p>
          <h1>
            {
              {
                dashboard: "Your operations, in focus.",
                inventory: "Inventory control.",
                orders: "Orders in motion.",
                analytics: "Clarity through data.",
                settings: "Make it your workspace.",
              }[section]
            }
          </h1>
          <p className="muted">
            {
              {
                dashboard:
                  "A connected perspective on everything that moves your business.",
                inventory: "Know what you have. Exactly where you have it.",
                orders: "From customer request to accurate stock allocation.",
                analytics:
                  "Real records. Meaningful patterns. Informed decisions.",
                settings: "Your account, preferences, and session controls.",
              }[section]
            }
          </p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={exportData}>
            <Download size={15} /> Export snapshot
          </button>
          {["inventory", "orders"].includes(section) && account.manager ? (
            <Button
              className="primary"
              onClick={() => {
                setError("");
                setLines([{ inventoryItemId: 0, quantity: 1 }]);
                setModal("create");
              }}
            >
              <Plus size={16} />{" "}
              {section === "inventory" ? "Add inventory" : "Create order"}
            </Button>
          ) : (
            <button
              className="secondary-button"
              disabled={loading}
              onClick={load}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
            </button>
          )}
        </div>
      </div>
      {error && !modal && !deleting && (
        <div className="error" role="alert">
          {error} <button onClick={load}>Try again</button>
        </div>
      )}
      {loading ? (
        <div className="loading-grid" aria-label="Loading workspace">
          {[1, 2, 3, 4].map((i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : (
        <>
          {section === "dashboard" && (
            <DashboardOverview
              inventory={inventory}
              orders={orders}
              distribution={distribution}
              onDetail={(detail) => {
                setDetail(detail);
                setModal("detail");
              }}
              onError={setError}
            />
          )}
          {["inventory", "orders"].includes(section) && (
            <section className="panel data-panel">
              <div className="table-toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label={`Search ${section}`}
                    placeholder={`Search ${section === "inventory" ? "items, locations, or ID" : "customers or order ID"}…`}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                {section === "inventory" && (
                  <>
                    <select
                      aria-label="Filter location"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All locations</option>
                      {distribution.map((l) => (
                        <option key={l.name}>{l.name}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Sort inventory"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="name">Name A–Z</option>
                      <option value="quantity">Stock: low to high</option>
                    </select>
                  </>
                )}
                <span className="record-count">
                  <SlidersHorizontal size={14} /> {total} records
                </span>
              </div>
              {!account.manager && (
                <p className="read-only">
                  Viewer access · A Manager can create and delete records.
                </p>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {(section === "inventory"
                        ? [
                            "Item / identifier",
                            "Location",
                            "Available units",
                            "Stock level",
                            "",
                          ]
                        : ["Order", "Customer", "Date placed", "Units", ""]
                      ).map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section === "inventory"
                      ? filtered
                          .slice((currentPage - 1) * 8, currentPage * 8)
                          .map((i) => (
                            <tr key={i.itemId}>
                              <td>
                                <button
                                  className="item-link"
                                  onClick={() => {
                                    setDetail(i);
                                    setModal("detail");
                                  }}
                                >
                                  <span className="item-icon">
                                    <Box size={19} />
                                  </span>
                                  <span>
                                    {i.name}
                                    <small>
                                      INV-{String(i.itemId).padStart(4, "0")}
                                    </small>
                                  </span>
                                </button>
                              </td>
                              <td>
                                <span className="location-label">
                                  <MapPin size={13} />
                                  {i.location}
                                </span>
                              </td>
                              <td className="quantity">
                                {number(i.quantity)}
                                <div className="stock-track">
                                  <i
                                    style={{
                                      width: `${Math.min(100, i.quantity)}%`,
                                    }}
                                  />
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${i.quantity <= 10 ? "warning" : ""}`}
                                >
                                  {i.quantity === 0
                                    ? "Out of stock"
                                    : i.quantity <= 10
                                      ? "Low stock"
                                      : "Available"}
                                </span>
                              </td>
                              <td>
                                {account.manager && (
                                  <button
                                    className="icon-button danger"
                                    aria-label={`Delete ${i.name}`}
                                    onClick={() => {
                                      setError("");
                                      setDeleting({
                                        id: i.itemId,
                                        kind: "inventory",
                                      });
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                      : filteredOrders
                          .slice((currentPage - 1) * 8, currentPage * 8)
                          .map((o) => (
                            <tr key={o.orderId}>
                              <td>
                                <button
                                  className="item-link"
                                  onClick={async () => {
                                    try {
                                      setDetail(
                                        await api<OrderDetail>(
                                          `orders/${o.orderId}`,
                                        ),
                                      );
                                      setModal("detail");
                                    } catch (e) {
                                      setError(String(e));
                                    }
                                  }}
                                >
                                  ORD-{String(o.orderId).padStart(4, "0")}
                                  <ArrowUpRight size={14} />
                                </button>
                              </td>
                              <td>{o.customerName}</td>
                              <td>{date(o.datePlaced)}</td>
                              <td>{number(o.itemCount)}</td>
                              <td>
                                {account.manager && (
                                  <button
                                    className="icon-button danger"
                                    aria-label={`Delete order ${o.orderId}`}
                                    onClick={() => {
                                      setError("");
                                      setDeleting({
                                        id: o.orderId,
                                        kind: "orders",
                                      });
                                    }}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                  </tbody>
                </table>
              </div>
              {total === 0 && (
                <Empty
                  title={`No ${section} found`}
                  message="Try another search, or create your first record."
                />
              )}
              <div className="pagination">
                <span>
                  {total} records · Page {currentPage} of {pages}
                </span>
                <div>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <button
                    disabled={currentPage >= pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          )}
          {section === "analytics" && (
            <>
              <div className="analytics-intro">
                <span className="tag">Based on current API records</span>
                <label>
                  Order date range{" "}
                  <select
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last year</option>
                  </select>
                </label>
              </div>
              <div
                className="stat-grid"
                aria-label="Stock availability summary"
              >
                {[
                  [
                    "Healthy stock (>10)",
                    inventory.filter((item) => item.quantity > 10).length,
                  ],
                  [
                    "Low stock (1–10)",
                    inventory.filter(
                      (item) => item.quantity > 0 && item.quantity <= 10,
                    ).length,
                  ],
                  [
                    "Out of stock",
                    inventory.filter((item) => item.quantity === 0).length,
                  ],
                  ["Total recorded orders", orders.length],
                ].map(([label, value]) => (
                  <article className="stat-card" key={label}>
                    <div>{label}</div>
                    <strong>{number(Number(value))}</strong>
                    <small>Current API records</small>
                  </article>
                ))}
              </div>
              <div className="two-column">
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Orders over time</h3>
                    <span className="tag">{days} days</span>
                  </div>
                  <Charts data={trend} trend />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Inventory distribution</h3>
                  </div>
                  <Charts data={distribution} />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Top inventory items</h3>
                  </div>
                  <Charts
                    data={[...inventory]
                      .sort((a, b) => b.quantity - a.quantity)
                      .slice(0, 6)
                      .map((i) => ({ name: i.name, value: i.quantity }))}
                  />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h3>Low-stock watchlist</h3>
                    <span className="tag">≤ 10 units</span>
                  </div>
                  {low.length ? (
                    low.map((i) => (
                      <div className="summary-row" key={i.itemId}>
                        <span>
                          {i.name}
                          <small>{i.location}</small>
                        </span>
                        <span className="status-badge warning">
                          {i.quantity === 0
                            ? "Out of stock"
                            : `${i.quantity} units`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title="Stock levels look healthy"
                      message="No inventory is below the threshold."
                    />
                  )}
                </section>
              </div>
              <section className="panel" style={{ marginTop: 20 }}>
                <div className="panel-heading">
                  <h3>Most frequently ordered products</h3>
                  <span className="tag">
                    All recorded orders · by order count
                  </span>
                </div>
                {analyticsError ? (
                  <p role="alert" className="error">
                    {analyticsError}
                  </p>
                ) : orderedProducts.length ? (
                  <>
                    <Charts
                      data={orderedProducts.map((item) => ({
                        name: item.name,
                        value: item.orderCount,
                      }))}
                      metric="Orders containing product"
                    />
                    <div className="table-scroll">
                      <table>
                        <caption className="sr-only">
                          Product order frequency and total ordered units
                        </caption>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Recorded orders</th>
                            <th>Ordered units</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderedProducts.map((item) => (
                            <tr key={item.inventoryItemId}>
                              <td>{item.name}</td>
                              <td>{item.orderCount}</td>
                              <td>{item.orderedUnits}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <Empty
                    title="No ordered products yet"
                    message="Order lines will populate this chart when available."
                  />
                )}
              </section>
              <p className="muted footnote">
                Order history reflects existing orders only. Deleted orders are
                excluded. No shipment or revenue metrics are inferred.
              </p>
            </>
          )}
          {section === "settings" && (
            <div className="settings-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h3>Account & access</h3>
                </div>
                <div className="setting-row">
                  <span>Email address</span>
                  <strong>{account.email}</strong>
                </div>
                <div className="setting-row">
                  <span>Workspace role</span>
                  <span className="tag">
                    {account.manager ? "Manager" : "Viewer"}
                  </span>
                </div>
                <p className="muted">
                  Profile editing and password changes are not currently
                  supported by the API.
                </p>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h3>Appearance & motion</h3>
                </div>
                <label className="setting-row">
                  Color theme
                  <select
                    defaultValue={
                      typeof window !== "undefined"
                        ? localStorage.getItem("logitrack-theme") || "dark"
                        : "dark"
                    }
                    onChange={(e) => {
                      localStorage.setItem("logitrack-theme", e.target.value);
                      document.documentElement.classList.toggle(
                        "light",
                        e.target.value === "light",
                      );
                    }}
                  >
                    <option value="dark">Midnight</option>
                    <option value="light">Daylight</option>
                  </select>
                </label>
                <label className="setting-row">
                  Motion preference
                  <select
                    defaultValue={
                      typeof window !== "undefined"
                        ? localStorage.getItem("logitrack-motion") || "system"
                        : "system"
                    }
                    onChange={(e) => {
                      localStorage.setItem("logitrack-motion", e.target.value);
                      document.documentElement.classList.toggle(
                        "reduce-motion",
                        e.target.value === "reduced",
                      );
                    }}
                  >
                    <option value="system">Follow device</option>
                    <option value="reduced">Reduce motion</option>
                  </select>
                </label>
                <p className="muted">
                  Preferences are saved on this device. The 3D scene also
                  follows your system’s reduced-motion preference.
                </p>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h3>Current session</h3>
                </div>
                <p className="muted">
                  Sessions expire after one hour. Sign out to clear this
                  browser’s session cookie.
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await api("auth/logout", "POST");
                    router.replace("/login");
                    router.refresh();
                  }}
                >
                  Sign out of this session
                </Button>
              </section>
            </div>
          )}
        </>
      )}
      <Dialog
        open={Boolean(modal)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setModal("");
            setError("");
          }
        }}
      >
        <DialogContent className="form-dialog">
          <DialogTitle>
            {modal === "create"
              ? section === "inventory"
                ? "Add inventory"
                : "Create order"
              : "Record details"}
          </DialogTitle>
          <DialogDescription>
            {modal === "create"
              ? "Changes are saved to your logistics database."
              : "Current record from the logistics API."}
          </DialogDescription>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === "create" ? (
            <form onSubmit={create}>
              {section === "inventory" ? (
                <>
                  <label>
                    Item name
                    <input name="name" required maxLength={120} />
                  </label>
                  <div className="form-row">
                    <label>
                      Quantity
                      <input
                        name="quantity"
                        type="number"
                        min="0"
                        max="2147483647"
                        required
                        defaultValue="0"
                      />
                    </label>
                    <label>
                      Location
                      <input name="location" required maxLength={120} />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label>
                    Customer name
                    <input name="customerName" required maxLength={120} />
                  </label>
                  <p className="muted">
                    Stock is reserved immediately when the order is created.
                  </p>
                  {lines.map((line, index) => (
                    <div className="order-line" key={index}>
                      <label>
                        Inventory item
                        <select
                          required
                          value={line.inventoryItemId || ""}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, n) =>
                                n === index
                                  ? {
                                      ...l,
                                      inventoryItemId: Number(e.target.value),
                                    }
                                  : l,
                              ),
                            )
                          }
                        >
                          <option value="">Select inventory</option>
                          {inventory.map((i) => (
                            <option
                              disabled={!i.quantity}
                              key={i.itemId}
                              value={i.itemId}
                            >
                              {i.name} · {i.quantity} available
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Units
                        <input
                          aria-label={`Line ${index + 1} quantity`}
                          type="number"
                          min="1"
                          max={
                            inventory.find(
                              (i) => i.itemId === line.inventoryItemId,
                            )?.quantity || 1
                          }
                          required
                          value={line.quantity}
                          onChange={(e) =>
                            setLines(
                              lines.map((l, n) =>
                                n === index
                                  ? { ...l, quantity: Number(e.target.value) }
                                  : l,
                              ),
                            )
                          }
                        />
                      </label>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          aria-label="Remove order line"
                          onClick={() =>
                            setLines(lines.filter((_, n) => n !== index))
                          }
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      setLines([...lines, { inventoryItemId: 0, quantity: 1 }])
                    }
                  >
                    <Plus size={15} /> Add order line
                  </button>
                </>
              )}
              <Button type="submit" disabled={busy} className="primary wide">
                {busy ? "Saving…" : "Save record"}
              </Button>
            </form>
          ) : (
            detail && (
              <div className="details">
                {"itemId" in detail ? (
                  <>
                    <div className="detail-hero">
                      <Box size={32} />
                      <h3>{detail.name}</h3>
                    </div>
                    <div className="summary-row">
                      Location<strong>{detail.location}</strong>
                    </div>
                    <div className="summary-row">
                      Available units<strong>{number(detail.quantity)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Order #{detail.orderId}</h3>
                    <p>
                      {detail.customerName} · {date(detail.datePlaced)}
                    </p>
                    {detail.items.map((i) => (
                      <div className="summary-row" key={i.inventoryItemId}>
                        <span>{i.name}</span>
                        <strong>{i.quantity} units</strong>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            Delete this{" "}
            {deleting?.kind === "inventory" ? "inventory record" : "order"}?
          </DialogTitle>
          <DialogDescription>
            {deleting?.kind === "orders"
              ? "Ordered quantities will be restored to inventory. This cannot be undone."
              : "Inventory referenced by an order cannot be deleted. This cannot be undone."}
          </DialogDescription>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!deleting || busy) return;
              setBusy(true);
              try {
                await api(`${deleting.kind}/${deleting.id}`, "DELETE");
                success("Record deleted successfully.");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Delete failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Confirm deletion"}
          </Button>
        </DialogContent>
      </Dialog>
      {toast && (
        <div className="toast" role="status">
          <span className="status-dot" />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
