import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';
import { TradeRequestController } from './trade-request.controller';
import { TradeRequestService } from './trade-request.service';
import { ItemService } from './services/item.service';
import { TradeManagementService } from './services/trade-management.service';
import { ReviewService } from './services/review.service';
import { FileService } from './services/file.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, NotificationModule, ConfigModule],
  controllers: [TradeController, TradeRequestController],
  providers: [
    TradeService,
    TradeRequestService,
    ItemService,
    TradeManagementService,
    ReviewService,
    FileService,
  ],
  exports: [
    TradeService,
    TradeRequestService,
    ItemService,
    TradeManagementService,
    ReviewService,
    FileService,
  ],
})
export class TradeModule {}
