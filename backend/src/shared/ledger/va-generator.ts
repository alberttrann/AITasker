import { customAlphabet } from 'nanoid';

export function generateVaNumber(VAEntityType: string): string {
  const nanoid = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    8,
  );

  return (VAEntityType + nanoid()).replaceAll('_', '');
}
