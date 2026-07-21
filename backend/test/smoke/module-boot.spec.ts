import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

describe('Application module boot — DI wiring smoke test', () => {
  it('resolves the full dependency graph without errors', async () => {
    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).resolves.toBeDefined();
  });
});
