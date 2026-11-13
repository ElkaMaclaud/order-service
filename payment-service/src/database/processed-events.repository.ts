import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type Database } from './database.constants';
import { processedEvents } from './schema';

export type DatabaseTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

@Injectable()
export class ProcessedEventsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async processOnce<T>(
    eventId: string,
    eventType: string,
    handler: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<{ processed: true; result: T } | { processed: false }> {
    return this.database.transaction(async (transaction) => {
      const [insertedEvent] = await transaction
        .insert(processedEvents)
        .values({ eventId, eventType })
        .onConflictDoNothing()
        .returning({ eventId: processedEvents.eventId });

      if (!insertedEvent) {
        return { processed: false };
      }

      const result = await handler(transaction);
      return { processed: true, result };
    });
  }
}
