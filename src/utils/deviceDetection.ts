/**
 * Device detection utilities
 * Uses bowser library for accurate browser and platform detection
 */
import Bowser from 'bowser';

/**
 * Detects device type from user agent string
 * @param userAgent The User-Agent header string
 * @returns Device type classification (mobile, tablet, desktop)
 */
export function detectDeviceType(userAgent: string): string {
  const parser = Bowser.getParser(userAgent);
  const platformType = parser.getPlatformType();
  
  if (platformType === 'mobile') {
    return 'mobile';
  } else if (platformType === 'tablet') {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Detects browser type from user agent string
 * @param userAgent The User-Agent header string
 * @returns Browser type classification
 */
export function detectBrowser(userAgent: string): string {
  const parser = Bowser.getParser(userAgent);
  const browser = parser.getBrowser();
  return browser.name ?? 'Other';
}

/**
 * Detects operating system from user agent string
 * @param userAgent The User-Agent header string
 * @returns Operating system classification
 */
export function detectOS(userAgent: string): string {
  const parser = Bowser.getParser(userAgent);
  const os = parser.getOS();
  return os.name ?? 'Other';
} 