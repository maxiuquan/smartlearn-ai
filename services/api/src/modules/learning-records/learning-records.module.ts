import { Module } from '@nestjs/common';
import { LearningRecordsController } from './learning-records.controller';
import { LearningRecordsService } from './learning-records.service';

@Module({
  controllers: [LearningRecordsController],
  providers: [LearningRecordsService],
  exports: [LearningRecordsService],
})
export class LearningRecordsModule {}
