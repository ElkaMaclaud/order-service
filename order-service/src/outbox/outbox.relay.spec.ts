import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PG_POOL } from '../database/database.module';
import { KAFKA_PRODUCER } from '../kafka/kafka.module';
import { OutboxRelay } from './outbox.relay';

const event = {
  id: '0199c1a2-3b4c-7d5e-8f60-123456789abc',
  aggregate_id: '01a12692-e9f1-7ef7-a427-f9402c26d116',
  event_type: 'order.created',
  payload: { totalAmount: 10000, currency: 'RUB' },
  created_at: new Date('2026-10-25T12:00:00.000Z'),
};

describe('OutboxRelay', () => {
  let module: TestingModule;
  let relay: OutboxRelay;
  let client: { query: jest.Mock; release: jest.Mock };
  let producer: { send: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    producer = { send: jest.fn().mockResolvedValue(undefined) };
    module = await Test.createTestingModule({
      providers: [
        OutboxRelay,
        {
          provide: PG_POOL,
          useValue: { connect: jest.fn().mockResolvedValue(client) },
        },
        { provide: KAFKA_PRODUCER, useValue: producer },
      ],
    }).compile();
    relay = module.get(OutboxRelay);
  });

  afterEach(async () => {
    await module.close();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function selectEvents(rows: (typeof event)[]) {
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows });
  }

  async function publishFirstBatch() {
    relay.onApplicationBootstrap();
    await jest.advanceTimersByTimeAsync(0);
  }

  it('publishes the event envelope before marking the batch and committing', async () => {
    selectEvents([event]);
    producer.send.mockImplementation(async () => {
      expect(client.query).toHaveBeenCalledTimes(2);
    });

    await publishFirstBatch();

    expect(producer.send).toHaveBeenCalledTimes(1);
    expect(producer.send).toHaveBeenCalledWith({
      topic: 'orders',
      messages: [
        {
          key: event.aggregate_id,
          value: JSON.stringify({
            eventId: event.id,
            eventType: event.event_type,
            occurredAt: event.created_at,
            payload: event.payload,
          }),
          headers: { 'event-type': event.event_type },
        },
      ],
    });
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      'UPDATE outbox SET published_at = now() WHERE id = ANY($1::uuid[])',
      [[event.id]],
    );
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back without marking events as published when Kafka fails', async () => {
    selectEvents([event]);
    const error = new Error('Kafka unavailable');
    producer.send.mockRejectedValue(error);
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    await publishFirstBatch();

    expect(producer.send).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      'Failed to publish outbox batch',
      error.stack,
    );
  });

  it('commits an empty batch without sending to Kafka', async () => {
    selectEvents([]);

    await publishFirstBatch();

    expect(producer.send).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
