// @ts-nocheck
// Compatibility shim for @walletconnect/utils.
// Re-export the original runtime bundle and provide a minimal `createLogger` export
// so bundles that expect the old utils.createLogger continue to function.
/* eslint-disable import/no-unresolved, @typescript-eslint/explicit-module-boundary-types */

// Re-export the actual runtime bundle to preserve all of the other helpers.
// The path is intentionally to the dist JS file so webpack will include the
// real runtime implementation instead of this shim.
// @ts-ignore
export * from "../node_modules/@walletconnect/utils/dist/index.js";

// Provide a createLogger implementation that prefers the official v2 logger
// utilities when available, otherwise falls back to a simple console logger.
import { generatePlatformLogger } from "@walletconnect/logger";
export function createLogger({ logger, name }: { logger?: any; name?: string } = {}) {
	if (logger && typeof logger === "object") {
		return logger;
	}

	try {
		const maybe = generatePlatformLogger?.({});
		const platformLogger = maybe?.logger;
		if (platformLogger) {
			// pino cluster: create a child logger when a name/context is provided
			if (name && typeof platformLogger.child === "function") {
				try {
					return platformLogger.child({ context: name });
				} catch (_) {
					return platformLogger;
				}
			}
			return platformLogger;
		}
	} catch (e) {
		// ignore and fall back to console
	}

	const prefix = name ? `[${name}]` : "[walletconnect]";
	return {
		debug: (...args: any[]) => console.debug(prefix, ...args),
		info: (...args: any[]) => console.info(prefix, ...args),
		warn: (...args: any[]) => console.warn(prefix, ...args),
		error: (...args: any[]) => console.error(prefix, ...args),
	};
}

// Default export: re-export real utils as the default so both named and default imports work.
// @ts-ignore
import * as _realUtils from "../node_modules/@walletconnect/utils/dist/index.js";
export default _realUtils;
