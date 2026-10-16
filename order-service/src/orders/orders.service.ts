import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersRepository } from './orders.repository';
import { Order } from './entities/order.entity';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrdersPageDto } from './dto/orders-page.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly orderRepository: OrdersRepository) {}

  create(createOrderDto: CreateOrderDto): Promise<Order> {
    const totalAmount = createOrderDto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    return this.orderRepository.create({ ...createOrderDto, totalAmount });
  }

  async findAll(query: ListOrdersQueryDto): Promise<OrdersPageDto> {
    const orders = await this.orderRepository.findMany({
      ...query,
      limit: query.limit + 1,
    });
    const hasMore = orders.length > query.limit;
    const data = hasMore ? orders.slice(0, query.limit) : orders;
    return {
      data,
      nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
    };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  async cancel(id: string): Promise<Order> {
    const cancelled = await this.orderRepository.cancelIfPending(id);
    const order = await this.findOne(id);
    if (!cancelled && order.status !== 'cancelled') {
      throw new ConflictException(
        `Order ${id} cannot be cancelled in status ${order.status}`,
      );
    }
    return order;
  }
}
