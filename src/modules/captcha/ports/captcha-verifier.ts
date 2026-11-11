/**
 * Puerto de la verificación anti-robots (captcha). Hoy lo cumple un verificador de prueba; la versión real llama al
 * proveedor elegido (Cloudflare Turnstile, hCaptcha, reCAPTCHA…) con CAPTCHA_SECRET, sin tocar el guard ni los
 * controladores. Devuelve false si el token no es válido y lanza un error si no pudo consultar al proveedor.
 */
export interface CaptchaVerifier {
  verify(token: string, ip: string): Promise<boolean>;
}

export const CAPTCHA_VERIFIER = Symbol('CAPTCHA_VERIFIER');
