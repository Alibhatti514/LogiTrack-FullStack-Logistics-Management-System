"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Package,
  Layers,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import {
  api,
  type Inventory,
  type Order,
  type OrderDetail,
} from "@/lib/models";
import { EmptyState as Empty } from "./empty-state";
import { number, date } from "@/lib/format";
const Warehouse = dynamic(() => import("./warehouse-scene"), {
  ssr: false,
  loading: () => <div className="warehouse skeleton" />,
});
const Charts = dynamic(() => import("./charts"), { ssr: false });
export function DashboardOverview({
  inventory,
  orders,
  distribution,
  onDetail,
  onError,
}: {
  inventory: Inventory[];
  orders: Order[];
  distribution: { name: string; value: number }[];
  onDetail: (detail: OrderDetail) => void;
  onError: (error: string) => void;
}) {
  const units = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const low = inventory.filter((item) => item.quantity <= 10);
  return (
    <>
      <section className="overview-banner">
        <div className="banner-copy">
          <div className="live-pill">
            <span className="status-dot" /> OPERATIONS OVERVIEW
          </div>
          <h2>
            Complex logistics.
            <br />
            <span>Beautifully connected.</span>
          </h2>
          <p>
            Your entire inventory network.
            <br />
            One intelligent vantage point.
          </p>
          <Link className="text-link" href="/inventory">
            Explore your inventory <ArrowUpRight size={16} />
          </Link>
          <div className="banner-meta">
            <span>
              <strong>{distribution.length.toString().padStart(2, "0")}</strong>{" "}
              LOCATIONS
            </span>
            <span>
              <strong>{number(units)}</strong> STOCK UNITS
            </span>
          </div>
        </div>
        <Warehouse inventory={inventory} />
      </section>
      <section className="stat-grid">
        {[
          [
            Package,
            "Inventory records",
            inventory.length,
            "Distinct stocked items",
          ],
          [Layers, "Available stock", units, "Units across all locations"],
          [
            ShoppingBag,
            "Total orders",
            orders.length,
            "Orders currently recorded",
          ],
          [
            TriangleAlert,
            "Low-stock items",
            low.length,
            "Threshold: 10 units or fewer",
          ],
        ].map(([Icon, label, value, caption]) => {
          const I = Icon as typeof Package;
          return (
            <article className="stat-card" key={String(label)}>
              <div>
                <span>{String(label)}</span>
                <I size={18} />
              </div>
              <strong>{number(Number(value))}</strong>
              <small>{String(caption)}</small>
            </article>
          );
        })}
      </section>
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">NETWORK BALANCE</p>
              <h3>Inventory by location</h3>
            </div>
            <span className="tag">Stock units</span>
          </div>
          <Charts data={distribution} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">LATEST MOVEMENTS</p>
              <h3>Recent orders</h3>
            </div>
            <Link href="/orders" aria-label="View all orders">
              <ArrowUpRight size={19} />
            </Link>
          </div>
          {orders.length ? (
            orders.slice(0, 4).map((o) => (
              <button
                className="activity-row"
                key={o.orderId}
                onClick={async () => {
                  try {
                    onDetail(await api<OrderDetail>(`orders/${o.orderId}`));
                  } catch (e) {
                    onError(String(e));
                  }
                }}
              >
                <span className="activity-icon">
                  <ShoppingBag size={17} />
                </span>
                <span>
                  <strong>{o.customerName}</strong>
                  <small>
                    Order #{o.orderId} · {date(o.datePlaced)}
                  </small>
                </span>
                <span>
                  {o.itemCount} units
                  <ArrowUpRight size={14} />
                </span>
              </button>
            ))
          ) : (
            <Empty
              title="Your first order starts here"
              message="Created orders will appear in your activity feed."
            />
          )}
        </section>
      </div>
      <section className="panel low-panel">
        <div>
          <TriangleAlert size={20} />
          <div>
            <h3>Stay ahead of low stock</h3>
            <p>
              {low.length
                ? `${low.length} inventory records have 10 units or fewer available.`
                : "All inventory records are above the low-stock threshold."}
            </p>
          </div>
        </div>
        <Link href="/inventory">
          Review inventory <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
