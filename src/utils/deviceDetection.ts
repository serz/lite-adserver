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

/**
 * Detects browser type from user agent string
 * @param userAgent The User-Agent header string
 * @returns Browser type classification
 */
export function detectBrowser(userAgent: string): string {
  if (/chrome|chromium/i.test(userAgent) && !/edg|edge/i.test(userAgent)) {
    return 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    return 'Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome|chromium/i.test(userAgent)) {
    return 'Safari';
  } else if (/edg|edge/i.test(userAgent)) {
    return 'Edge';
  } else if (/msie|trident/i.test(userAgent)) {
    return 'Internet Explorer';
  } else if (/opera|opr/i.test(userAgent)) {
    return 'Opera';
  } else {
    return 'Other';
  }
}

/**
 * Detects operating system from user agent string
 * @param userAgent The User-Agent header string
 * @returns Operating system classification
 */
export function detectOS(userAgent: string): string {
  if (/windows/i.test(userAgent)) {
    return 'Windows';
  } else if (/mac os|macintosh/i.test(userAgent) && !/iphone|ipad/i.test(userAgent)) {
    return 'macOS';
  } else if (/linux/i.test(userAgent) && !/android/i.test(userAgent)) {
    return 'Linux';
  } else if (/android/i.test(userAgent)) {
    return 'Android';
  } else if (/iphone|ipad|ipod|ios/i.test(userAgent)) {
    return 'iOS';
  } else {
    return 'Other';
  }
} 