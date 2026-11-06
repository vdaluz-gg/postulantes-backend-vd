export interface OnboardingInput {
  readonly candidateId: string;
  readonly fullName: string;
  /** Solo dígitos. */
  readonly dni: string;
  readonly position: string;
}

/**
 * Puerto del alta del colaborador en el ERP (KTNA). Hoy lo cumple un mock; la versión real es el ADP BOT
 * (proveedor JPH), que da de alta a quien obtiene una asignación y avisa a Nómina. Debe lanzar un error si no
 * pudo dar de alta a la persona: el servicio deja la contratación registrada y el alta pendiente de reintento.
 */
export interface EmployeeOnboarding {
  register(input: OnboardingInput): Promise<{ employeeNumber: string }>;
}

export const EMPLOYEE_ONBOARDING = Symbol('EMPLOYEE_ONBOARDING');
