import { Test, TestingModule }     from '@nestjs/testing';
import { INestApplication }        from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule }               from '../../src/app.module';

import supertest = require('supertest');

describe('Swagger spec validation', () => {
  let app: INestApplication;
  let swaggerJson: Record<string, any>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    const config = new DocumentBuilder()
      .setTitle('AITasker API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.init();

    const res = await supertest(app.getHttpServer()).get('/api-json').expect(200);
    swaggerJson = res.body;
  });

  afterAll(async () => { await app.close(); });

  it('generates a valid OpenAPI 3.x spec', () => {
    expect(swaggerJson.openapi).toMatch(/^3\./);
    expect(swaggerJson.paths).toBeDefined();
    expect(swaggerJson.components).toBeDefined();
  });

  const REQUIRED_ENDPOINTS: Array<[string, string]> = [
    ['post', '/auth/register'],
    ['post', '/auth/login'],
    ['put',  '/auth/switch-role'],
    ['post', '/auth/register-handoff'],
    ['post', '/auth/refresh'],
    ['post', '/elicitation/sessions'],
    ['get',  '/elicitation/sessions/{id}'],
    ['put',  '/elicitation/sessions/{id}/stage1'],
    ['put',  '/elicitation/sessions/{id}/stage2'],
    ['put',  '/elicitation/sessions/{id}/stage3'],
    ['put',  '/elicitation/sessions/{id}/stage4'],
    ['put',  '/elicitation/sessions/{id}/stage4-handoff'],
    ['post', '/elicitation/sessions/{id}/invite-tech-team'],   
    ['put',  '/elicitation/sessions/{id}/self-technical'],     
    ['post', '/elicitation/sessions/{id}/retry-synthesis'],    
    ['get',  '/wallets/me'],
    ['get',  '/wallets/me/transactions'],
    ['post', '/wallets/virtual-accounts/topup'],
    ['post', '/webhooks/sepay/ipn'],
    ['post', '/subscriptions/activate'],                       
    ['get',  '/subscriptions/status'],                         
  ];

  it.each(REQUIRED_ENDPOINTS)(
    '%s %s is documented in the spec',
    (method, path) => {
      const pathEntry = swaggerJson.paths[path];
      expect(pathEntry).toBeDefined();
      expect(pathEntry[method]).toBeDefined();
    },
  );

  it('POST /elicitation/sessions/{id}/confirm no longer exists (replaced by retry-synthesis)', () => {
    const pathEntry = swaggerJson.paths['/elicitation/sessions/{id}/confirm'];
    expect(pathEntry).toBeUndefined();
  });

  const JWT_PROTECTED = [
    '/elicitation/sessions',
    '/wallets/me',
    '/auth/switch-role',
  ];

  it.each(JWT_PROTECTED)(
    '%s documents Bearer auth requirement',
    (path) => {
      const methods = Object.values(swaggerJson.paths[path] ?? {}) as any[];
      const hasSecurity = methods.some(
        (m) => m?.security?.some((s: any) => 'bearer' in s || 'JWT' in s),
      );
      expect(hasSecurity).toBe(true);
    },
  );
});