/**
 * Type guard utilities to help with TypeScript strict mode
 */

/**
 * Ensures a value is a string
 * 
 * @param value - The value to check
 * @param defaultValue - Optional default value if the input is null/undefined
 * @returns The string value or default
 */
export function ensureString(value: string | null | undefined, defaultValue: string = ''): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  return value;
}

/**
 * Ensures a value is an array, applying a provided mapping function if needed
 * 
 * @param value - The value to check
 * @param defaultValue - Optional default value if the input is null/undefined
 * @returns The array or default
 */
export function ensureArray<T>(value: T[] | null | undefined, defaultValue: T[] = []): T[] {
  if (!value || !Array.isArray(value)) {
    return defaultValue;
  }
  return value;
}

/**
 * Ensures a value is a number
 * 
 * @param value - The value to check
 * @param defaultValue - Optional default value if the input is null/undefined
 * @returns The number value or default
 */
export function ensureNumber(value: number | null | undefined, defaultValue: number = 0): number {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return defaultValue;
  }
  return Number(value);
}

/**
 * Converts a URLSearchParams object to a Record
 * 
 * @param params - The URLSearchParams object
 * @returns An object with the params as key-value pairs
 */
export function paramsToObject(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
} 