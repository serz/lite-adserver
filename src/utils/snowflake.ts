/**
 * Snowflake ID Generator
 * 
 * This implementation generates unique, roughly sortable IDs based on the Twitter Snowflake algorithm.
 * All generated IDs are guaranteed to be positive numbers.
 * 
 * The ID structure:
 * - 41 bits for timestamp (milliseconds since custom epoch)
 * - 10 bits for worker ID (0-1023)
 * - 12 bits for sequence number (0-4095)
 * 
 * This gives us a total of 63 bits, fitting into a positive BIGINT.
 * The MSB (Most Significant Bit) is always 0 to ensure IDs are positive.
 */

// Constants for bit shifts
const EPOCH = 1609459200000; // 2021-01-01 as our custom epoch
const TIMESTAMP_BITS = 41;   // Using 41 bits for timestamp (gives ~69 years from custom epoch)
const WORKER_ID_BITS = 10;   // Using 10 bits for worker ID
const SEQUENCE_BITS = 12;    // Using 12 bits for sequence

// Calculated constants
const MAX_WORKER_ID = (1 << WORKER_ID_BITS) - 1; // 1023
const MAX_SEQUENCE = (1 << SEQUENCE_BITS) - 1;   // 4095

// The maximum timestamp value that can be represented with 41 bits
const MAX_TIMESTAMP = (1n << BigInt(TIMESTAMP_BITS)) - 1n;

// Bit shifts
const WORKER_ID_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;

export class SnowflakeIdGenerator {
  private workerId: number;
  private sequence: number = 0;
  private lastTimestamp: number = -1;

  /**
   * Create a new Snowflake ID generator
   * @param workerId Worker ID (0-1023)
   */
  constructor(workerId: number = 0) {
    if (workerId < 0 || workerId > MAX_WORKER_ID) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`);
    }
    this.workerId = workerId;
  }

  /**
   * Generate a new Snowflake ID
   * @returns A unique 64-bit positive ID as a bigint
   */
  public nextId(): bigint {
    let timestamp = Date.now();

    // Ensure we don't exceed the timestamp limit
    const adjustedTimestamp = timestamp - EPOCH;
    if (adjustedTimestamp > Number(MAX_TIMESTAMP)) {
      throw new Error('Timestamp exceeds the maximum value supported by this Snowflake implementation');
    }

    // Clock moved backwards - throw error or wait
    if (timestamp < this.lastTimestamp) {
      throw new Error(`Clock moved backwards. Refusing to generate ID for ${this.lastTimestamp - timestamp} milliseconds.`);
    }

    // Same millisecond - increment sequence
    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & MAX_SEQUENCE;
      // Sequence overflow - wait for next millisecond
      if (this.sequence === 0) {
        timestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      // Different millisecond - reset sequence
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    // Compose the 64-bit ID from our components
    // The result is guaranteed to be positive because we're using 63 bits total (MSB is always 0)
    const id = BigInt(adjustedTimestamp) << BigInt(TIMESTAMP_SHIFT) |
              BigInt(this.workerId) << BigInt(WORKER_ID_SHIFT) |
              BigInt(this.sequence);
    
    // Verify that the ID is positive (this check is for debugging/validation and could be removed in production)
    if (id < 0n) {
      throw new Error(`Generated a negative Snowflake ID: ${id}. This should never happen.`);
    }
    
    return id;
  }

  /**
   * Wait for the next millisecond
   * @param lastTimestamp Last timestamp when ID was generated
   * @returns New timestamp
   */
  private waitNextMillis(lastTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= lastTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }

  /**
   * Extract timestamp from a Snowflake ID
   * @param id Snowflake ID
   * @returns Timestamp when the ID was generated
   */
  public static getTimestampFromId(id: bigint): number {
    if (id < 0n) {
      throw new Error('Negative IDs are not valid Snowflake IDs');
    }
    return Number((id >> BigInt(TIMESTAMP_SHIFT)) + BigInt(EPOCH));
  }

  /**
   * Extract worker ID from a Snowflake ID
   * @param id Snowflake ID
   * @returns Worker ID that generated the ID
   */
  public static getWorkerIdFromId(id: bigint): number {
    if (id < 0n) {
      throw new Error('Negative IDs are not valid Snowflake IDs');
    }
    return Number((id >> BigInt(WORKER_ID_SHIFT)) & BigInt(MAX_WORKER_ID));
  }

  /**
   * Extract sequence number from a Snowflake ID
   * @param id Snowflake ID
   * @returns Sequence number of the ID
   */
  public static getSequenceFromId(id: bigint): number {
    if (id < 0n) {
      throw new Error('Negative IDs are not valid Snowflake IDs');
    }
    return Number(id & BigInt(MAX_SEQUENCE));
  }

  /**
   * Convert a Snowflake ID to a string
   * @param id Snowflake ID
   * @returns String representation of the ID
   */
  public static toString(id: bigint): string {
    if (id < 0n) {
      throw new Error('Negative IDs are not valid Snowflake IDs');
    }
    return id.toString();
  }
}

// Singleton instance for use throughout the application
let idGenerator: SnowflakeIdGenerator | null = null;

/**
 * Get the global Snowflake ID generator instance
 * @param workerId Optional worker ID to use
 * @returns Singleton SnowflakeIdGenerator instance
 */
export function getIdGenerator(workerId?: number): SnowflakeIdGenerator {
  if (!idGenerator) {
    idGenerator = new SnowflakeIdGenerator(workerId);
  }
  return idGenerator;
}

/**
 * Generate a new Snowflake ID using the global generator
 * @returns A unique positive ID as a bigint
 */
export function generateSnowflakeId(): bigint {
  return getIdGenerator().nextId();
} 