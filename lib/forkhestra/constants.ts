/**
 * Shared constants for forkhestra
 *
 * These constants are used across multiple modules and are placed here
 * to avoid circular dependency issues.
 */

/**
 * Marker that agents output to signal completion
 *
 * When an agent outputs this marker on its own line, the forkhestra
 * orchestrator knows the agent has completed its work and should stop looping.
 */
export const COMPLETION_MARKER = "FORKHESTRA_COMPLETE";
