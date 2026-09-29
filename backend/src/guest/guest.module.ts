import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module.js';
import { GuestController } from './guest.controller.js';
import { GuestService } from './guest.service.js';
import { PhotosController } from './photos.controller.js';

@Module({
  imports: [EventsModule],
  controllers: [GuestController, PhotosController],
  providers: [GuestService],
})
export class GuestModule {}
