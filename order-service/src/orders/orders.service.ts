import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersRepository } from './orders.repository';
import { Order } from './entities/order.entity';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

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

  async findAll(query: ListOrdersQueryDto) {
    const orders = await this.orderRepository.findMany({
      ...query,
      limit: query.limit + 1,
    });
    const hasMore = orders.length > query.limit;
    const data = hasMore ? orders.slice(0, query.limit) : orders;
    return {
      data,
      nextCursor: hasMore ? data.at(-1)?.id : null,
    };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
