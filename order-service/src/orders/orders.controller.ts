import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Query, HttpStatus, HttpCode } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  findAll(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.cancel(id)
  }
}
