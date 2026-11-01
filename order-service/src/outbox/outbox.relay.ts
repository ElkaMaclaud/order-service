import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { KAFKA_PRODUCER } from '../kafka/kafka.module';

const TOPIC = 'orders';
const BATCH_SIZE = 100;
const POLL_INTERVAL_MS = 1000;

interface OutboxRow {
  id: string;
  aggregate_id: string;
  event_type: string;
  payload: unknown;
  created_at: Date;
}

@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private currentRun?: Promise<void>;
  private stopped = false;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(KAFKA_PRODUCER) private readonly producer: KafkaJS.Producer,
  ) {}

  onApplicationBootstrap() {
    this.scheduleNext(0);
  }

  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.currentRun;
  }

  private scheduleNext(delayMs: number) {
    if (this.stopped) {
      return;
    }
    this.timer = setTimeout(() => {
      this.currentRun = this.runOnce();
    }, delayMs);
  }

  private async runOnce(): Promise<void> {
    let published = 0;
    try {
      published = await this.publishBatch();
    } catch (error) {
      this.logger.error(
        'Failed to publish outbox batch',
        error instanceof Error ? error.stack : String(error),
      );
    }
    this.scheduleNext(published === BATCH_SIZE ? 0 : POLL_INTERVAL_MS);
  }

  private async publishBatch(): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OutboxRow>(
        `SELECT id, aggregate_id, event_type, payload, created_at
         FROM outbox
         WHERE published_at IS NULL
         ORDER BY id
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [BATCH_SIZE],
      );

      if (rows.length > 0) {
        await this.producer.send({
          topic: TOPIC,
          messages: rows.map((row) => ({
            key: row.aggregate_id,
            value: JSON.stringify({
              eventId: row.id,
              eventType: row.event_type,
              occurredAt: row.created_at,
              payload: row.payload,
            }),
            headers: { 'event-type': row.event_type },
          })),
        });
        await client.query(
          'UPDATE outbox SET published_at = now() WHERE id = ANY($1::uuid[])',
          [rows.map((row) => row.id)],
        );
      }

      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
