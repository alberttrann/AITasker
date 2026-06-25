import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);

export function generateVaNumber(VAEntityType: string): string {
  return (VAEntityType + nanoid()).replaceAll('_', '');
}
