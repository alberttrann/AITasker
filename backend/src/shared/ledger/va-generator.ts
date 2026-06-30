import { customAlphabet } from 'nanoid';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SUFFIX_LENGTH = 8;

const generateSuffix = customAlphabet(ALPHABET, SUFFIX_LENGTH);

export function generateVaNumber(prefix: string): string {
  return (prefix + generateSuffix()).replaceAll('_', '');
}
