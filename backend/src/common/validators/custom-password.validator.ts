import { ValidateBy, ValidationOptions } from 'class-validator';

export function HasUppercase(validationOptions?: ValidationOptions) {
  return ValidateBy(
    { name: 'hasUppercase', validator: { validate: (v) => typeof v === 'string' && /[A-Z]/.test(v) } },
    validationOptions,
  );
}

export function HasLowercase(validationOptions?: ValidationOptions) {
  return ValidateBy(
    { name: 'hasLowercase', validator: { validate: (v) => typeof v === 'string' && /[a-z]/.test(v) } },
    validationOptions,
  );
}

export function HasNumber(validationOptions?: ValidationOptions) {
  return ValidateBy(
    { name: 'hasNumber', validator: { validate: (v) => typeof v === 'string' && /[0-9]/.test(v) } },
    validationOptions,
  );
}

export function HasSpecialChar(validationOptions?: ValidationOptions) {
  return ValidateBy(
    { name: 'hasSpecialChar', validator: { validate: (v) => typeof v === 'string' && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(v) } },
    validationOptions,
  );
}