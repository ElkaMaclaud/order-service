import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { KafkaModule } from '../kafka/kafka.module';
import { OutboxRelay } from './outbox.relay';

@Module({
  imports: [DatabaseModule, KafkaModule],
  providers: [OutboxRelay],
})
export class OutboxModule {}
