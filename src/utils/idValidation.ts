/**
 * Utility functions for ID parsing and validation
 */

/**
 * Parse a string or number ID into a number
 * @param id ID value which can be either a string or a number
 * @returns The parsed numeric ID
 */
export function parseId(id: string | number): number {
  if (typeof id === 'number') {
    return id;
  }
  return parseInt(id, 10);
}

/**
 * Validate if an ID is a valid number
 * @param id ID value to validate
 * @returns true if valid, false otherwise
 */
export function isValidId(id: string | number): boolean {
  const numericId = parseId(id);
  return !isNaN(numericId) && numericId > 0;
}

/**
 * Parse and validate an ID, returning the numeric ID or null if invalid
 * @param id ID value to parse and validate
 * @param entityName Optional entity name for logging purposes
 * @returns The numeric ID if valid, null otherwise
 */
export function parseAndValidateId(id: string | number, entityName = 'entity'): number | null {
  const numericId = parseId(id);
  if (isNaN(numericId) || numericId <= 0) {
    console.error(`Invalid ${entityName} ID format:`, id);
    return null;
  }
  return numericId;
}

/**
 * Parse a comma-separated string of IDs into an array of numbers
 * @param idsString Comma-separated string of IDs
 * @returns Array of valid numeric IDs
 */
export function parseIdList(idsString: string): number[] {
  return idsString
    .split(',')
    .map(id => {
      const parsedId = parseInt(id.trim(), 10);
      return isNaN(parsedId) ? 0 : parsedId;
    })
    .filter(id => id > 0);
} 