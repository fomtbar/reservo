import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CourtsModule } from './modules/courts/courts.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { SettingsModule } from './modules/settings/settings.module';
import { StatsModule } from './modules/stats/stats.module';
import { UsersModule } from './modules/users/users.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { PromosModule } from './modules/promos/promos.module';
import { BranchesModule } from './modules/branches/branches.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = new URL(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        );
        return {
          connection: {
            host: redisUrl.hostname,
            port: parseInt(redisUrl.port || '6379'),
          },
        };
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    UsersModule,
    AuthModule,
    CourtsModule,
    ScheduleModule,
    PricingModule,
    BookingsModule,
    CustomersModule,
    DashboardModule,
    JobsModule,
    NotificationsModule,
    PaymentsModule,
    SettingsModule,
    StatsModule,
    WaitlistModule,
    PromosModule,
    LoyaltyModule,
    BranchesModule,
  ],
})
export class AppModule {}
