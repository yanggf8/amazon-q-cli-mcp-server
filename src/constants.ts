/**
 * Configuration constants for Amazon Q CLI MCP Server
 *
 * Centralized configuration to avoid magic numbers and allow
 * easy customization through environment variables
 */

/**
 * Get configuration value from environment or use default
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = typeof process !== 'undefined' ? process.env[key] : undefined;
  return value ? parseInt(value, 10) : defaultValue;
}

/**
 * Server configuration constants
 */
export const CONFIG = {
  // Command execution timeouts
  COMMAND_TIMEOUT_MS: getEnvNumber('Q_MCP_TIMEOUT', 30000),

  // Output size limits
  MAX_OUTPUT_SIZE_BYTES: getEnvNumber('Q_MCP_MAX_OUTPUT', 1024 * 1024), // 1MB default

  // Fetch chunk limits
  MAX_FETCH_SIZE_BYTES: getEnvNumber('Q_MCP_MAX_FETCH', 10 * 1024 * 1024), // 10MB default
  DEFAULT_FETCH_SIZE_BYTES: getEnvNumber('Q_MCP_DEFAULT_FETCH', 65536), // 64KB default

  // Prompt limits
  MAX_PROMPT_LENGTH: getEnvNumber('Q_MCP_MAX_PROMPT', 10000),

  // Retry configuration
  MAX_RETRIES: getEnvNumber('Q_MCP_MAX_RETRIES', 3),
  RETRY_BASE_DELAY_MS: getEnvNumber('Q_MCP_RETRY_BASE_DELAY', 500),
  RETRY_MAX_DELAY_MS: getEnvNumber('Q_MCP_RETRY_MAX_DELAY', 10000),
  RETRY_JITTER_FACTOR: 0.25,

  // Session management
  STALE_SESSION_CUTOFF_MS: getEnvNumber('Q_MCP_STALE_CUTOFF', 15 * 60 * 1000), // 15 minutes default

  // Logging configuration
  LOG_SIZE_LIMIT_BYTES: getEnvNumber('Q_MCP_LOG_SIZE_LIMIT', 50 * 1024 * 1024), // 50MB default
  LOG_SIZE_CHECK_INTERVAL: getEnvNumber('Q_MCP_LOG_CHECK_INTERVAL', 100),

  // Session ID configuration
  SESSION_ID_MAX_LENGTH: 50,

  // Diagnostics caching
  DIAGNOSTICS_CACHE_TTL_MS: getEnvNumber('Q_MCP_DIAGNOSTICS_CACHE_TTL', 30000), // 30 seconds default

  // Registry update debouncing
  REGISTRY_UPDATE_DEBOUNCE_MS: getEnvNumber('Q_MCP_REGISTRY_DEBOUNCE', 1000), // 1 second default
} as const;

/**
 * Allowed Q CLI commands (whitelist for security)
 */
export const ALLOWED_Q_COMMANDS = [
  'chat',
  'translate',
  'status',
  'doctor',
  '--version'
] as const;

/**
 * Allowed HTTP headers for fetch_chunk (whitelist for security)
 */
export const ALLOWED_HTTP_HEADERS = [
  'Accept',
  'Accept-Language',
  'Accept-Encoding',
  'Cache-Control'
] as const;

/**
 * Allowed URL schemes for fetch_chunk (security)
 */
export const ALLOWED_URL_SCHEMES = [
  'http://',
  'https://'
] as const;

/**
 * Server metadata
 */
export const SERVER_INFO = {
  NAME: 'amazon-q-cli-mcp-server',
  VERSION: '1.0.0',
  PROTOCOL_VERSION: '2024-11-05',
  USER_AGENT: 'amazon-q-mcp-server/1.0.0'
} as const;

/**
 * Tool names
 */
export const TOOL_NAMES = {
  ASK_Q: 'ask_q',
  TAKE_Q: 'take_q',
  Q_TRANSLATE: 'q_translate',
  FETCH_CHUNK: 'fetch_chunk',
  Q_STATUS: 'q_status'
} as const;

/**
 * Activity log types
 */
export const LOG_TYPES = {
  SERVER_INIT: 'SERVER_INIT',
  SERVER_READY: 'SERVER_READY',
  TOOL_CALL: 'TOOL_CALL',
  TOOL_SUCCESS: 'TOOL_SUCCESS',
  TOOL_ERROR: 'TOOL_ERROR',
  RETRY_ATTEMPT: 'RETRY_ATTEMPT',
  MCP_ERROR: 'MCP_ERROR',
  SHUTDOWN: 'SHUTDOWN',
  CLEANUP: 'CLEANUP',
  CLEANUP_ERROR: 'CLEANUP_ERROR',
  TRANSPORT_INIT: 'TRANSPORT_INIT',
  SERVER_CONNECTED: 'SERVER_CONNECTED',
  SESSION_START: 'SESSION_START',
  SESSION_END: 'SESSION_END',
  STATUS_CHANGE: 'STATUS_CHANGE',
  REGISTRY_ERROR: 'REGISTRY_ERROR',
  LOG_ROTATED: 'LOG_ROTATED',
  LOG_ERROR: 'LOG_ERROR',
  SESSION_CLEANUP: 'SESSION_CLEANUP',
  STARTUP_ERROR: 'STARTUP_ERROR'
} as const;
