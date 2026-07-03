import { Module } from '@nestjs/common';
import { ExerciseBooksController } from './exercise-books.controller';
import { ExerciseBooksService } from './exercise-books.service';

@Module({
  controllers: [ExerciseBooksController],
  providers: [ExerciseBooksService],
  exports: [ExerciseBooksService],
})
export class ExerciseBooksModule {}
