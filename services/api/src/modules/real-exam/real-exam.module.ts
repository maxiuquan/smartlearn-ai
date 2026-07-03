import { Module } from '@nestjs/common';
import { RealExamController } from './real-exam.controller';
import { RealExamService } from './real-exam.service';

@Module({
  controllers: [RealExamController],
  providers: [RealExamService],
  exports: [RealExamService],
})
export class RealExamModule {}
