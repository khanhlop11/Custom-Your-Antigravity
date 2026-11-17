/** OpenRouter's published ReasoningEffort enum; ordering is low to high for the picker. */
export declare const REASONING_EFFORTS: readonly ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export declare function normalizeReasoningEfforts(value: unknown): ReasoningEffort[] | undefined;
/** Only explicit catalog metadata proves effort support. Names and supported_parameters do not. */
export declare function catalogReasoningEfforts(item: Record<string, any>, openRouter: boolean): ReasoningEffort[] | undefined;
//# sourceMappingURL=reasoningEfforts.d.ts.map