"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REASONING_EFFORTS = void 0;
exports.normalizeReasoningEfforts = normalizeReasoningEfforts;
exports.catalogReasoningEfforts = catalogReasoningEfforts;
/** OpenRouter's published ReasoningEffort enum; ordering is low to high for the picker. */
exports.REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
function normalizeReasoningEfforts(value) {
    if (!Array.isArray(value) || value.some((effort) => !exports.REASONING_EFFORTS.includes(effort)))
        return undefined;
    return exports.REASONING_EFFORTS.filter((effort) => value.includes(effort));
}
/** Only explicit catalog metadata proves effort support. Names and supported_parameters do not. */
function catalogReasoningEfforts(item, openRouter) {
    const reasoning = item.reasoning;
    if (!reasoning || typeof reasoning !== 'object' || Array.isArray(reasoning))
        return undefined;
    const declared = reasoning.supported_efforts;
    // Official OpenRouter schema: null means every gateway effort is accepted.
    const efforts = declared === null && openRouter ? [...exports.REASONING_EFFORTS] : normalizeReasoningEfforts(declared);
    return reasoning.mandatory === true ? efforts?.filter((effort) => effort !== 'none') : efforts;
}
//# sourceMappingURL=reasoningEfforts.js.map