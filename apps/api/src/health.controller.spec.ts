import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import type { PrismaService } from './common/prisma/prisma.service';

/**
 * The health check used to return `status: 'ok'` and code 200 even with an
 * unreachable database. Neither Docker's `HEALTHCHECK` nor a load balancer could
 * then tell that the instance was useless - hence this test.
 */
describe('HealthController', () => {
  const responseStub = () => {
    const statuses: number[] = [];
    return {
      response: {
        status: (code: number) => statuses.push(code),
      } as unknown as Response,
      statuses,
    };
  };

  const controllerWith = (queryRaw: () => Promise<unknown>) =>
    new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);

  it('reports 200 and "ok" when the database responds', async () => {
    const { response, statuses } = responseStub();
    const controller = controllerWith(() => Promise.resolve([{ 1: 1 }]));

    await expect(controller.check(response)).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    // Without an explicit override, Nest's default 200 stays.
    expect(statuses).toEqual([]);
  });

  it('reports 503 when the database does not respond', async () => {
    const { response, statuses } = responseStub();
    const controller = controllerWith(() =>
      Promise.reject(new Error('connection refused')),
    );

    await expect(controller.check(response)).resolves.toEqual({
      status: 'degraded',
      database: 'down',
    });
    expect(statuses).toEqual([HttpStatus.SERVICE_UNAVAILABLE]);
  });
});
