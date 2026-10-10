import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { Order, OrderItem, OrderStatus } from './entities/order.entity';

interface OrderRow {
  id: string;
  customer_id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  created_at: Date;
  updated_at: Date;
}

interface OrderItemRow {
  id: string;
  product_id: string;
  unit_price: number;
  quantity: number;
}

export interface NewOrder {
  customerId: string;
  currency?: string;
  totalAmount: number;
  items: { productId: string; unitPrice: number; quantity: number }[];
}

@Injectable()
export class OrdersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(data: NewOrder): Promise<Order> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const {
        rows: [orderRow],
      } = await client.query<OrderRow>(
        `INSERT INTO orders (customer_id, total_amount, currency)
         VALUES ($1, $2, COALESCE($3, 'RUB'))
         RETURNING *`,
        [data.customerId, data.totalAmount, data.currency ?? null],
      );

      const { rows: itemRows } = await client.query<OrderItemRow>(
        `INSERT INTO order_items (order_id, product_id, unit_price, quantity)
         SELECT $1::uuid, * FROM unnest($2::uuid[], $3::bigint[], $4::int[])
         RETURNING id, product_id, unit_price, quantity`,
        [
          orderRow.id,
          data.items.map((item) => item.productId),
          data.items.map((item) => item.unitPrice),
          data.items.map((item) => item.quantity),
        ],
      );

      await client.query('COMMIT');
      return toOrder(orderRow, itemRows);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function toOrder(row: OrderRow, itemRows: OrderItemRow[]): Order {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    totalAmount: row.total_amount,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: itemRows.map(toOrderItem),
  };
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id,
    unitPrice: row.unit_price,
    quantity: row.quantity,
  };
}