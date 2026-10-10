export type OrderStatus = 'pending' | 'paid' | 'payment_failed' | 'cancelled';

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
