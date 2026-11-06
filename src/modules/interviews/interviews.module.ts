import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../applications/entities/application.entity';
import { AuthModule } from '../auth/auth.module';
import { Zone } from '../zones/entities/zone.entity';
import { InterviewRoom } from './entities/interview-room.entity';
import { Interview } from './entities/interview.entity';
import { InterviewRoomsService } from './interview-rooms.service';
import { ApplicationInterviewsController, InterviewRoomsController, InterviewsController } from './interviews.controllers';
import { InterviewsService } from './interviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([Interview, InterviewRoom, Application, Zone]), AuthModule],
  controllers: [InterviewRoomsController, ApplicationInterviewsController, InterviewsController],
  providers: [InterviewRoomsService, InterviewsService],
})
export class InterviewsModule {}
