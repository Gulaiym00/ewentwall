import { Module } from '@nestjs/common';
import { ContentController, ReviewsController } from './reviews.controller.js';

@Module({ controllers: [ReviewsController, ContentController] })
export class ReviewsModule {}
