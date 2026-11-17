import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { normalizeReasoningEfforts, catalogReasoningEfforts } from '../reasoningEfforts';
import { ModelStore, SecretCodec } from '../modelStore';
import { applyRequestOptions } from '../proxy/requestOptions';
import type { CustomModel } from '../proxy';

const mockCodec: SecretCodec = {
  encryptString: (v) => `enc:${v}`,
  decryptString: (v) => v.replace(/^enc:/, ''),
};

describe('Reasoning Auto-Discovery & Variants', () => {
  let tmpDir: string;
  let storeFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-reasoning-test-'));
    storeFile = path.join(tmpDir, 'custom_models.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses OpenRouter reasoning metadata including xhigh and preserves order', () => {
    const openRouterModel = {
      id: 'openai/o3-mini',
      name: 'o3-mini',
      reasoning: {
        default_effort: 'medium',
        default_enabled: true,
        mandatory: false,
        supported_efforts: ['xhigh', 'high', 'medium', 'low'],
      },
    };

    const efforts = catalogReasoningEfforts(openRouterModel, true);
    expect(efforts).toEqual(['low', 'medium', 'high', 'xhigh']);
  });

  it('filters out "none" when reasoning is mandatory', () => {
    const mandatoryModel = {
      id: 'openai/o1',
      name: 'o1',
      reasoning: {
        mandatory: true,
        supported_efforts: ['none', 'low', 'medium', 'high', 'xhigh'],
      },
    };

    const efforts = catalogReasoningEfforts(mandatoryModel, true);
    expect(efforts).toEqual(['low', 'medium', 'high', 'xhigh']);
    expect(efforts).not.toContain('none');
  });

  it('returns undefined for models without explicit reasoning metadata', () => {
    const plainModel = {
      id: 'google/gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
    };

    expect(catalogReasoningEfforts(plainModel, true)).toBeUndefined();
    expect(catalogReasoningEfforts(plainModel, false)).toBeUndefined();
  });

  it('automatically generates variants including (xhigh) on save when reasoningEfforts are present', () => {
    const store = new ModelStore(storeFile, mockCodec);
    store.save({
      name: 'models/openrouter-o3-mini',
      externalModelName: 'openai/o3-mini',
      displayName: 'o3-mini',
      provider: 'openrouter',
      apiUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      autoEffortVariants: true,
      supportsThinking: true,
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    }, true);

    const models = store.read();
    expect(models).toHaveLength(5); // 1 base + 4 variants

    const base = models.find((m) => m.name === 'models/openrouter-o3-mini');
    expect(base).toBeDefined();

    const variants = models.filter((m) => m.effortVariantOf === 'models/openrouter-o3-mini');
    expect(variants).toHaveLength(4);

    const xhighVariant = variants.find((m) => m.reasoningEffort === 'xhigh');
    expect(xhighVariant).toBeDefined();
    expect(xhighVariant?.displayName).toBe('o3-mini (xhigh)');
    expect(xhighVariant?.name).toBe('models/openrouter-o3-mini-xhigh');

    const lowVariant = variants.find((m) => m.reasoningEffort === 'low');
    expect(lowVariant?.displayName).toBe('o3-mini (low)');

    const mediumVariant = variants.find((m) => m.reasoningEffort === 'medium');
    expect(mediumVariant?.displayName).toBe('o3-mini (medium)');

    const highVariant = variants.find((m) => m.reasoningEffort === 'high');
    expect(highVariant?.displayName).toBe('o3-mini (high)');
  });

  it('cascades delete from base model to all its effort variants', () => {
    const store = new ModelStore(storeFile, mockCodec);
    store.save({
      name: 'models/openrouter-o3-mini',
      externalModelName: 'openai/o3-mini',
      displayName: 'o3-mini',
      provider: 'openrouter',
      apiUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      autoEffortVariants: true,
      supportsThinking: true,
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    }, true);

    expect(store.read()).toHaveLength(5);

    store.delete('models/openrouter-o3-mini');
    expect(store.read()).toHaveLength(0);
  });

  it('removes effort variants when autoEffortVariants is set to false', () => {
    const store = new ModelStore(storeFile, mockCodec);
    store.save({
      name: 'models/openrouter-o3-mini',
      externalModelName: 'openai/o3-mini',
      displayName: 'o3-mini',
      provider: 'openrouter',
      apiUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      autoEffortVariants: true,
      supportsThinking: true,
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    }, true);

    expect(store.read()).toHaveLength(5);

    // Disable auto efforts
    store.save({
      name: 'models/openrouter-o3-mini',
      externalModelName: 'openai/o3-mini',
      displayName: 'o3-mini',
      provider: 'openrouter',
      apiUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-key',
      autoEffortVariants: false,
      supportsThinking: true,
    }, true);

    expect(store.read()).toHaveLength(1);
    expect(store.read()[0].name).toBe('models/openrouter-o3-mini');
  });

  it('translates request with reasoning object for OpenRouter with xhigh effort', () => {
    const model: CustomModel = {
      name: 'models/openrouter-o3-mini-xhigh',
      externalModelName: 'openai/o3-mini',
      provider: 'openrouter',
      apiUrl: 'https://openrouter.ai/api/v1',
      reasoningEffort: 'xhigh',
      effortVariantOf: 'models/openrouter-o3-mini',
    };

    const translated = applyRequestOptions({}, model, 'openai', true);
    expect(translated.reasoning).toEqual({ effort: 'xhigh', enabled: true });
    expect(translated.reasoning_effort).toBeUndefined();
  });

  it('translates request with reasoning_effort for generic OpenAI providers with xhigh effort', () => {
    const model: CustomModel = {
      name: 'models/openai-o3-mini-xhigh',
      externalModelName: 'o3-mini',
      provider: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      reasoningEffort: 'xhigh',
      effortVariantOf: 'models/openai-o3-mini',
    };

    const translated = applyRequestOptions({}, model, 'openai', true);
    expect(translated.reasoning_effort).toBe('xhigh');
    expect(translated.reasoning).toBeUndefined();
  });
});
