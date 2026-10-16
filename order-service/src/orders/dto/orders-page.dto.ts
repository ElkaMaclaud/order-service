import { Order } from '../entities/order.entity';

export class OrdersPageDto {
  data: Order[];
  nextCursor: string | null;
}
