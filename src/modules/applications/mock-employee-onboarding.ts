import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { EmployeeOnboarding } from './ports/employee-onboarding';

/** Mock del ADP BOT: asigna un legajo con el formato del ERP (KT-000123) sin llamar a nadie. */
@Injectable()
export class MockEmployeeOnboarding implements EmployeeOnboarding {
  async register(): Promise<{ employeeNumber: string }> {
    return { employeeNumber: `KT-${String(randomInt(0, 1_000_000)).padStart(6, '0')}` };
  }
}
