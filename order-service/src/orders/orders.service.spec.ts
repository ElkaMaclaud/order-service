import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { Order } from './entities/order.entity';

const ORDER_ID = '01a12692-e9f1-7ef7-a427-f9402c26d116';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    customerId: '0199c1a2-3b4c-7d5e-8f60-123456789abc',
    status: 'pending',
    totalAmount: 0,
    currency: 'RUB',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: jest.Mocked<
    Pick<
      OrdersRepository,
      'create' | 'findById' | 'findMany' | 'cancelIfPending'
    >
  >;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      cancelIfPending: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('computes totalAmount from items', async () => {
      repository.create.mockResolvedValue(makeOrder());

      await service.create({
        customerId: '0199c1a2-3b4c-7d5e-8f60-123456789abc',
        items: [
          {
            productId: '0199c1a2-3b4c-7d5e-8f60-aaaaaaaaaaaa',
            unitPrice: 10000,
            quantity: 2,
          },
          {
            productId: '0199c1a2-3b4c-7d5e-8f60-bbbbbbbbbbbb',
            unitPrice: 5000,
            quantity: 1,
          },
        ],
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalAmount: 25000 }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the order', async () => {
      const order = makeOrder();
      repository.findById.mockResolvedValue(order);

      await expect(service.findOne(ORDER_ID)).resolves.toBe(order);
    });

    it('throws NotFoundException when order is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(ORDER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('requests limit + 1 and returns nextCursor when there are more', async () => {
      const orders = [
        makeOrder({ id: 'c' }),
        makeOrder({ id: 'b' }),
        makeOrder({ id: 'a' }),
      ];
      repository.findMany.mockResolvedValue(orders);

      const result = await service.findAll({ limit: 2 });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 3 }),
      );
      expect(result.data.map((order) => order.id)).toEqual(['c', 'b']);
      expect(result.nextCursor).toBe('b');
    });

    it('returns null nextCursor on the last page', async () => {
      repository.findMany.mockResolvedValue([makeOrder({ id: 'a' })]);

      const result = await service.findAll({ limit: 2 });

      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('cancel', () => {
    it('cancels a pending order', async () => {
      repository.cancelIfPending.mockResolvedValue(true);
      repository.findById.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      await expect(service.cancel(ORDER_ID)).resolves.toMatchObject({
        status: 'cancelled',
      });
    });

    it('is idempotent for an already cancelled order', async () => {
      repository.cancelIfPending.mockResolvedValue(false);
      repository.findById.mockResolvedValue(makeOrder({ status: 'cancelled' }));

      await expect(service.cancel(ORDER_ID)).resolves.toMatchObject({
        status: 'cancelled',
      });
    });

    it('throws ConflictException for a paid order', async () => {
      repository.cancelIfPending.mockResolvedValue(false);
      repository.findById.mockResolvedValue(makeOrder({ status: 'paid' }));

      await expect(service.cancel(ORDER_ID)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when order is missing', async () => {
      repository.cancelIfPending.mockResolvedValue(false);
      repository.findById.mockResolvedValue(null);

      await expect(service.cancel(ORDER_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
