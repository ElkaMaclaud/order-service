import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';

export const KAFKA_PRODUCER = 'KAFKA_PRODUCER';

@Module({
  providers: [
    {
      provide: KAFKA_PRODUCER,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const kafka = new KafkaJS.Kafka({
          kafkaJS: {
            clientId: 'order-service',
            brokers: configService.getOrThrow<string>('KAFKA_BROKERS').split(','),
          },
        });
        const producer = kafka.producer({ kafkaJS: { idempotent: true } });
        await producer.connect();
        return producer;
      },
    },
  ],
  exports: [KAFKA_PRODUCER],
})
export class KafkaModule implements OnModuleDestroy {
  constructor(
    @Inject(KAFKA_PRODUCER) private readonly producer: KafkaJS.Producer,
  ) {}

  async onModuleDestroy() {
    await this.producer.disconnect();
  }
}
