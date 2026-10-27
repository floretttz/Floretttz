import { fallbackCategories, fallbackProducts } from "@/lib/catalogue-fallback";
import type { AdminOrder, AdminOverview, Category, Product, ProductResponse } from "@/lib/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getWhatsAppNumber(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "917533832123";
}

export function getWhatsAppUrl(text: string = "Hello Floretttz! I would like to inquire about your handmade pieces."): string {
  return `https://wa.me/${getWhatsAppNumber()}?text=${encodeURIComponent(text)}`;
}

export function getWhatsAppGroupUrl(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ?? "https://chat.whatsapp.com/HQAdFVG6arGFh77oRGZsQk?s=cl&p=a&mlu=4&ilr=4";
}

export function getWhatsAppChannelUrl(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_URL ?? "https://whatsapp.com/channel/0029Vb9L4MLG3R3Zpsx31l1U";
}

export function isPlaceholderWhatsAppNumber(num?: string): boolean {
  const n = num ?? getWhatsAppNumber();
  return n.includes("9999999999") || n === "919999999999";
}

async function request<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}${path}`, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getCategories(): Promise<Category[]> {
  return (await request<Category[]>("/api/categories")) ?? fallbackCategories;
}

export async function getProducts(args: { q?: string; category?: string; sort?: string; page?: number; pageSize?: number } = {}): Promise<ProductResponse> {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.category) params.set("category", args.category);
  if (args.sort) params.set("sort", args.sort);
  params.set("page", String(args.page ?? 1));
  params.set("page_size", String(args.pageSize ?? 12));
  const data = await request<ProductResponse>(`/api/products?${params.toString()}`);
  if (data) return data;
  let items = fallbackProducts.filter((item) => item.published);
  if (args.q) {
    const query = args.q.toLowerCase();
    items = items.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(query));
  }
  if (args.category) items = items.filter((item) => item.category?.slug === args.category);
  if (args.sort === "price_asc") items = [...items].sort((a, b) => Number(a.price) - Number(b.price));
  if (args.sort === "price_desc") items = [...items].sort((a, b) => Number(b.price) - Number(a.price));
  const pageSize = args.pageSize ?? 12;
  const page = args.page ?? 1;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, page_size: pageSize };
}

export async function getProduct(slug: string): Promise<Product | null> {
  return (await request<Product>(`/api/products/${slug}`)) ?? fallbackProducts.find((item) => item.slug === slug && item.published) ?? null;
}

export function formatINR(value: string | number | null): string {
  if (value === null) return "Price on request";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
}

// --- Admin Client API ---

async function authenticatedFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  } as Record<string, string>;

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail = typeof payload === "object" && payload && "detail" in payload ? String(payload.detail) : "Request failed";
    throw new Error(detail);
  }
  return payload as T;
}

export async function fetchAuthMe(token: string): Promise<{ user_id: string; role: string }> {
  return authenticatedFetch<{ user_id: string; role: string }>(token, "/api/auth/me");
}

export async function adminLogin(payload: { email: string; password: string }): Promise<{
  access_token: string;
  token_type: string;
  role: string;
  email: string;
  user_id: string;
}> {
  const response = await fetch(`${apiUrl}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Invalid admin credentials");
  }
  return response.json();
}

export async function fetchAdminOverview(token: string): Promise<AdminOverview> {
  return authenticatedFetch<AdminOverview>(token, "/api/admin/overview");
}

export async function fetchAdminProducts(
  token: string,
  args: { q?: string; category?: string; status_filter?: string; page?: number; page_size?: number } = {}
): Promise<ProductResponse> {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.category) params.set("category", args.category);
  if (args.status_filter && args.status_filter !== "all") params.set("status_filter", args.status_filter);
  if (args.page) params.set("page", String(args.page));
  if (args.page_size) params.set("page_size", String(args.page_size));
  return authenticatedFetch<ProductResponse>(token, `/api/admin/products?${params.toString()}`);
}

export async function createAdminProduct(
  token: string,
  data: {
    sku: string;
    slug: string;
    name: string;
    description: string;
    price?: number | null;
    image_url?: string | null;
    published?: boolean;
    featured?: boolean;
    available_for_order?: boolean;
    category_id?: number | null;
  }
): Promise<Product> {
  return authenticatedFetch<Product>(token, "/api/admin/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminProduct(
  token: string,
  productId: number,
  data: Partial<{
    name: string;
    slug: string;
    description: string;
    price: number | null;
    image_url: string | null;
    published: boolean;
    available_for_order: boolean;
    featured: boolean;
    category_id: number | null;
  }>
): Promise<Product> {
  return authenticatedFetch<Product>(token, `/api/admin/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function createAdminVariant(
  token: string,
  productId: number,
  data: { sku: string; name: string; price: number; available_for_order?: boolean }
): Promise<void> {
  await authenticatedFetch(token, `/api/admin/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminVariant(token: string, variantId: number): Promise<void> {
  await authenticatedFetch(token, `/api/admin/variants/${variantId}`, {
    method: "DELETE",
  });
}

export async function fetchAdminOrders(token: string, statusFilter?: string): Promise<AdminOrder[]> {
  const query = statusFilter && statusFilter !== "all" ? `?status_filter=${statusFilter}` : "";
  return authenticatedFetch<AdminOrder[]>(token, `/api/admin/orders${query}`);
}

export async function updateAdminOrderStatus(token: string, orderId: number, status: string): Promise<AdminOrder> {
  return authenticatedFetch<AdminOrder>(token, `/api/admin/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function createAdminCategory(
  token: string,
  data: { slug: string; name: string; description?: string }
): Promise<Category> {
  return authenticatedFetch<Category>(token, "/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminCategory(
  token: string,
  categoryId: number,
  data: { name?: string; slug?: string; description?: string }
): Promise<Category> {
  return authenticatedFetch<Category>(token, `/api/admin/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getAdminCategoryProductCount(
  token: string,
  categoryId: number
): Promise<{ category_id: number; product_count: number }> {
  return authenticatedFetch<{ category_id: number; product_count: number }>(
    token,
    `/api/admin/categories/${categoryId}/product-count`
  );
}

export async function deleteAdminCategory(
  token: string,
  categoryId: number,
  reassignToId?: number
): Promise<{ status: string; id: number; reassigned_products?: number }> {
  const query = reassignToId ? `?reassign_to_id=${reassignToId}` : "";
  return authenticatedFetch<{ status: string; id: number; reassigned_products?: number }>(
    token,
    `/api/admin/categories/${categoryId}${query}`,
    {
      method: "DELETE",
    }
  );
}


export async function uploadAdminImage(
  token: string,
  file: File
): Promise<{ filename: string; url: string; size_bytes: number; mime_type: string }> {
  const form = new FormData();
  form.append("file", file);
  return authenticatedFetch<{ filename: string; url: string; size_bytes: number; mime_type: string }>(
    token,
    "/api/admin/upload-image",
    {
      method: "POST",
      body: form,
    }
  );
}

export async function fetchNotionStatus(token: string): Promise<{
  connected: boolean;
  configured: boolean;
  bot_user?: string;
  database_id?: string;
  database_title?: string;
  error?: string;
  details?: Record<string, unknown>;
}> {
  return authenticatedFetch(token, "/api/admin/notion/status");
}

export async function syncOrderToNotion(
  token: string,
  orderId: number
): Promise<{ success: boolean; page_id?: string; error?: string }> {
  return authenticatedFetch(token, `/api/admin/notion/sync/${orderId}`, { method: "POST" });
}

export async function fetchCommunityLinks(): Promise<{ whatsapp_group_url: string; whatsapp_channel_url: string }> {
  return (await request<{ whatsapp_group_url: string; whatsapp_channel_url: string }>("/api/community")) ?? {
    whatsapp_group_url: getWhatsAppGroupUrl(),
    whatsapp_channel_url: getWhatsAppChannelUrl(),
  };
}

