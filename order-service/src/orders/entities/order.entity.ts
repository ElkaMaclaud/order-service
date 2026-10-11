export interface OrderItem {
  id: string;
  productId: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'payment_failed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
