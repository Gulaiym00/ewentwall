import { Module } from '@nestjs/common';
import { AdminSupportController, SupportController } from './support.controller.js';

@Module({ controllers: [SupportController, AdminSupportController] })
export class SupportModule {}
