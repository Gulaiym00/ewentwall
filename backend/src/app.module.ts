import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { AccessTokenGuard, RolesGuard } from './common/guards.js';
import { AppThrottlerGuard } from './common/throttle.js';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { UsersModule } from './users/users.module.js';
import { EventsModule } from './events/events.module.js';
import { GuestModule } from './guest/guest.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { AdminModule } from './admin/admin.module.js';
import { SupportModule } from './support/support.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // 120 requests per minute per route for each guest/user (per IP without a token); sign-in is stricter.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    PlatformModule,
    StorageModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    EventsModule,
    GuestModule,
    ReviewsModule,
    AdminModule,
    SupportModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit → authenticate → authorize.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
