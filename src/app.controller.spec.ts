import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status', () => {
      expect(appController.getHealth()).toEqual({
        status: 'healthy',
        message: 'TradeShip API is running',
        timestamp: expect.any(String),
      });
    });
  });

  describe('health', () => {
    it('should return detailed health status', () => {
      const result = appController.getDetailedHealth();
      expect(result).toEqual({
        status: 'healthy',
        message: 'TradeShip API is running',
        version: '1.0.0',
        environment: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.any(Object),
      });
    });
  });
});
