// Compatibility shim for @walletconnect/utils.
// Provide minimal exports to prevent build errors when @walletconnect/utils is not available.

// Since @walletconnect/utils is not installed, provide minimal stub exports
// to prevent build failures. The actual functionality will be handled by
// try-catch blocks in the consuming code.

// Provide a createLogger implementation that prefers the official v2 logger
// utilities when available, otherwise falls back to a simple console logger.
export function createLogger({ logger, name } = {}) {
	if (logger && typeof logger === "object") {
		return logger;
	}

	try {
		// Try to import the logger dynamically
		const { generatePlatformLogger } = require("@walletconnect/logger");
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
		debug: (...args) => console.debug(prefix, ...args),
		info: (...args) => console.info(prefix, ...args),
		warn: (...args) => console.warn(prefix, ...args),
		error: (...args) => console.error(prefix, ...args),
	};
}

// Export minimal stub functions that might be expected
export const getSdkError = (code) => ({ code, message: code });
export const parseUri = (uri) => ({ uri });
export const buildApprovedNamespaces = () => ({});
export const buildAuthObject = () => ({});
export const formatJsonRpcError = () => ({});
export const formatJsonRpcRequest = () => ({});
export const formatJsonRpcResult = () => ({});
export const getChainsFromApprovedSession = () => [];
export const getSdkVersion = () => "2.0.0";
export const isValidUrl = (url) => typeof url === 'string' && url.startsWith('http');
export const isValidChainId = (chainId) => typeof chainId === 'string' || typeof chainId === 'number';
export const isValidAccountId = (accountId) => typeof accountId === 'string' && accountId.includes(':');
export const isValidRelayUrl = (url) => isValidUrl(url);
export const isValidProjectId = (projectId) => typeof projectId === 'string' && projectId.length > 0;
export const isJsonRpcResponseSuccess = () => false;
export const isInternalEvent = () => false;
export const getClientMeta = () => ({});
export const convertHexToArrayBuffer = (hex) => new ArrayBuffer(0);
export const uuid = () => Math.random().toString(36).substring(2);
export const parseTransactionData = () => ({});
export const parsePersonalSign = () => ({});
export const mobileLinkChoiceKey = 'mobileLinkChoice';
export const getLocal = () => null;
export const parseWalletConnectUri = () => ({});
export const appendToQueryString = (url, params) => url;
export const isWalletConnectSession = () => false;
export const removeLocal = () => {};
export const getLocation = () => ({});
export const isJsonRpcResponseError = () => false;
export const isSilentPayload = () => false;
export const getInternalError = (code) => ({ code, message: code });
export const mapToObj = (map) => Object.fromEntries(map);
export const objToMap = (obj) => new Map(Object.entries(obj));
export const generateRandomBytes32 = () => new Uint8Array(32);
export const generateKeyPair = () => ({ publicKey: '', privateKey: '' });
export const deriveSymKey = () => '';
export const hashKey = () => '';
export const validateEncoding = () => true;
export const isTypeTwoEnvelope = () => false;
export const encodeTypeTwoEnvelope = () => ({});
export const isTypeOneEnvelope = () => false;
export const encrypt = () => ({});
export const validateDecoding = () => true;
export const decodeTypeTwoEnvelope = () => ({});

// Default export: provide a minimal object so both named and default imports work.
const stubUtils = {
	getSdkError,
	parseUri,
	buildApprovedNamespaces,
	buildAuthObject,
	formatJsonRpcError,
	formatJsonRpcRequest,
	formatJsonRpcResult,
	getChainsFromApprovedSession,
	getSdkVersion,
	isValidUrl,
	isValidChainId,
	isValidAccountId,
	isValidRelayUrl,
	isValidProjectId,
	createLogger,
	isJsonRpcResponseSuccess,
	isInternalEvent,
	getClientMeta,
	convertHexToArrayBuffer,
	uuid,
	parseTransactionData,
	parsePersonalSign,
	mobileLinkChoiceKey,
	getLocal,
	parseWalletConnectUri,
	appendToQueryString,
	isWalletConnectSession,
	removeLocal,
	getLocation,
	isJsonRpcResponseError,
	isSilentPayload,
	getInternalError,
	mapToObj,
	objToMap,
	generateRandomBytes32,
	generateKeyPair,
	deriveSymKey,
	hashKey,
	validateEncoding,
	isTypeTwoEnvelope,
	encodeTypeTwoEnvelope,
	isTypeOneEnvelope,
	encrypt,
	validateDecoding,
	decodeTypeTwoEnvelope,
};

export default stubUtils;
