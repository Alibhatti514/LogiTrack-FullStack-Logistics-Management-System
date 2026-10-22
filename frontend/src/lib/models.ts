export interface Inventory {
  itemId: number;
  name: string;
  quantity: number;
  location: string;
}
export interface Order {
  orderId: number;
  customerName: string;
  datePlaced: string;
  itemCount: number;
}
export interface OrderDetail extends Order {
  items: { inventoryItemId: number; name: string; quantity: number }[];
}
export interface Account {
  email: string;
  manager: boolean;
}
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/gateway/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (response.status === 401) {
    window.location.reload();
    throw new Error("Your session expired. Please sign in again.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      body?.error ||
        (body?.errors && Object.values(body.errors).flat().join(" ")) ||
        "Request failed. Please try again.",
    );
  return body as T;
}

export interface OrderedProduct {
  inventoryItemId: number;
  name: string;
  orderedUnits: number;
  orderCount: number;
}
