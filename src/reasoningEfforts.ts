/** OpenRouter's published ReasoningEffort enum; ordering is low to high for the picker. */
export const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function normalizeReasoningEfforts(value: unknown): ReasoningEffort[] | undefined {
  if (!Array.isArray(value) || value.some((effort) => !REASONING_EFFORTS.includes(effort))) return undefined;
  return REASONING_EFFORTS.filter((effort) => value.includes(effort));
}

/** Only explicit catalog metadata proves effort support. Names and supported_parameters do not. */
export function catalogReasoningEfforts(item: Record<string, any>, openRouter: boolean): ReasoningEffort[] | undefined {
  const reasoning = item.reasoning;
  if (!reasoning || typeof reasoning !== 'object' || Array.isArray(reasoning)) return undefined;
  const declared = reasoning.supported_efforts;
  // Official OpenRouter schema: null means every gateway effort is accepted.
  const efforts = declared === null && openRouter ? [...REASONING_EFFORTS] : normalizeReasoningEfforts(declared);
  return reasoning.mandatory === true ? efforts?.filter((effort) => effort !== 'none') : efforts;
}
