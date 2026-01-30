import { FileChange, DiffHunk, SecurityRisk } from '../types';

const SECURITY_SENSITIVE_PATTERNS = [
  'auth',
  'token',
  'session',
  'password',
  'jwt',
  'credential',
  'secret',
  'oauth',
  'login',
  'logout',
  'signin',
  'signout',
  'permission',
  'role',
  'acl',
  'access',
  'encrypt',
  'decrypt',
  'hash',
  'salt',
  'key',
  'cert',
  'ssl',
  'tls',
  'csrf',
  'xss',
  'sanitize',
  'validate',
  'middleware',
  'guard',
  'policy',
];

const SECURITY_CODE_PATTERNS = [
  /bcrypt|argon2|scrypt/i,
  /jwt\.sign|jwt\.verify|jsonwebtoken/i,
  /passport\./i,
  /session\s*\(/i,
  /cookie\s*\(/i,
  /setcookie|document\.cookie/i,
  /localStorage|sessionStorage/i,
  /crypto\./i,
  /createHash|createCipher|createHmac/i,
  /Bearer\s+/i,
  /Authorization:/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /(?:password|hash|bcrypt).*\.compare\s*\(/i,
  /password.*=|=.*password/i,
];

export function detectSecurityRisks(
  fileChanges: FileChange[],
  diffHunks: DiffHunk[]
): SecurityRisk[] {
  const risks: SecurityRisk[] = [];
  const fileRisksMap = new Map<string, Set<string>>();

  // Check file paths for security-sensitive patterns
  for (const file of fileChanges) {
    const pathLower = file.path.toLowerCase();
    const reasons = new Set<string>();

    // Word-boundary matching: split path into segments so "key" doesn't match "keyboard"
    const segments = pathLower.split(/[/.\-_]/);
    for (const pattern of SECURITY_SENSITIVE_PATTERNS) {
      if (segments.includes(pattern)) {
        reasons.add(`File path contains '${pattern}'`);
      }
    }

    if (reasons.size > 0) {
      fileRisksMap.set(file.path, reasons);
    }
  }

  // Check diff content for security-sensitive code patterns
  for (const hunk of diffHunks) {
    const allChangedLines = [...hunk.addedLines, ...hunk.removedLines].join('\n');
    const reasons = fileRisksMap.get(hunk.file) || new Set<string>();

    for (const pattern of SECURITY_CODE_PATTERNS) {
      if (pattern.test(allChangedLines)) {
        const patternStr = pattern.toString().slice(1, -2); // Remove regex delimiters
        reasons.add(`Contains security-related code pattern`);
      }
    }

    // The following checks only apply to files already identified as security-related
    // by path matching. This prevents flagging CRUD routes that merely call auth utilities.
    const isSecurityFile = fileRisksMap.has(hunk.file);

    if (isSecurityFile) {
      // Check for middleware changes
      if (/middleware|interceptor|guard/i.test(hunk.file) ||
          /app\.use\s*\(|router\.use\s*\(/i.test(allChangedLines)) {
        reasons.add('Middleware modification detected');
      }

      // Check for login/logout logic
      if (/login|logout|signin|signout/i.test(allChangedLines)) {
        reasons.add('Login/logout logic modification');
      }

      // Check for permission checks
      if (/hasPermission|hasRole|can\(|ability|authorize/i.test(allChangedLines)) {
        reasons.add('Permission check modification');
      }

      // Check for token handling
      if (/accessToken|refreshToken|idToken|Bearer/i.test(allChangedLines)) {
        reasons.add('Token handling modification');
      }
    }

    if (reasons.size > 0) {
      fileRisksMap.set(hunk.file, reasons);
    }
  }

  // Convert map to array of SecurityRisk
  for (const [file, reasons] of fileRisksMap) {
    risks.push({
      file,
      reasons: Array.from(reasons),
    });
  }

  return risks;
}
