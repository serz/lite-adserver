/**
 * Device detection utilities
 * Extracts device type information from User-Agent strings
 */

/**
 * Detects device type from user agent string
 * @param userAgent The User-Agent header string
 * @returns Device type classification (mobile, tablet, desktop)
 */
export function detectDeviceType(userAgent: string): string {
  if (/mobile/i.test(userAgent)) {
    return 'mobile';
  } else if (/tablet/i.test(userAgent)) {
    return 'tablet';
  } else {
    return 'desktop';
  }
} 