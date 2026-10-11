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

  async findById(id: string): Promise<Order | null> {
    const {
      rows: [orderRow],
    } = await this.pool.query<OrderRow>('SELECT * FROM orders WHERE id = $1', [
      id,
    ]);
    if (!orderRow) {
      return null;
    }

    const { rows: itemRows } = await this.pool.query<OrderItemRow>(
      `SELECT id, product_id, unit_price, quantity
       FROM order_items
       WHERE order_id = $1
       ORDER BY id`,
      [id],
    );
    return toOrder(orderRow, itemRows);
  }

  async findMany(filter: {
    customerId?: string;
    status?: OrderStatus;
    cursor?: string;
    limit: number;
  }): Promise<Order[]> {
    const { rows: orderRows } = await this.pool.query<OrderRow>(
      `SELECT * FROM orders
       WHERE ($1::uuid IS NULL OR customer_id = $1)
         AND ($2::text IS NULL OR status = $2)
         AND ($3::uuid IS NULL OR id < $3)
       ORDER BY id DESC
       LIMIT $4`,
      [
        filter.customerId ?? null,
        filter.status ?? null,
        filter.cursor ?? null,
        filter.limit,
      ],
    );
    if (orderRows.length === 0) {
      return [];
    }

    const { rows: itemRows } = await this.pool.query<
      OrderItemRow & { order_id: string }
    >(
      `SELECT id, order_id, product_id, unit_price, quantity
       FROM order_items
       WHERE order_id = ANY($1::uuid[])
       ORDER BY id`,
      [orderRows.map((row) => row.id)],
    );

    const itemsByOrderId = new Map<string, OrderItemRow[]>();
    for (const item of itemRows) {
      const items = itemsByOrderId.get(item.order_id) ?? [];
      items.push(item);
      itemsByOrderId.set(item.order_id, items);
    }

    return orderRows.map((row) =>
      toOrder(row, itemsByOrderId.get(row.id) ?? []),
    );
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
