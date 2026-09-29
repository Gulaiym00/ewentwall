import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [EventsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
