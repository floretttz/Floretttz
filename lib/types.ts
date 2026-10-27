export type Category = { id: number; slug: string; name: string; description?: string | null };

export type Variant = { id: number; sku: string; name: string; price: string; available_for_order: boolean };

export type Product = {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price: string | null;
  image_url?: string | null;
  published: boolean;
  featured: boolean;
  available_for_order: boolean;
  category?: Category | null;
  variants: Variant[];
  created_at: string;
};

export type ProductResponse = { items: Product[]; total: number; page: number; page_size: number };

export type CartLine = { product: Product; variant?: Variant; quantity: number; personalisation?: string };

export type UserRole = "customer" | "catalog_manager" | "admin";

export type AdminOverview = {
  total_products: number;
  published_products: number;
  draft_products: number;
  total_categories: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: string | number;
};

export type AdminOrderItem = {
  id: number;
  product_id: number;
  variant_id?: number | null;
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: string;
};

export type AdminOrder = {
  id: number;
  reference: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  status: "pending" | "awaiting_confirmation" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  total: string;
  idempotency_key: string;
  created_at: string;
  items: AdminOrderItem[];
};
