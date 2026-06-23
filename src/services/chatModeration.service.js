const LABEL_NAMES = {
    0: 'clean',
    1: 'offensive',
    2: 'hate',
};

const GROUP_ATTACK_KEYWORDS = [
    'phân biệt vùng miền',
    'phan biet vung mien',
    'bọn vùng',
    'bon vung',
    'bọn miền',
    'bon mien',
];

const OFFENSIVE_KEYWORDS = ['ngu', 'câm', 'cam', 'óc', 'oc', 'lừa đảo', 'lua dao', 'phá live', 'pha live', 'spam', 'rác', 'rac', 'dỏm', 'dom', 'cút', 'cut'];

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const buildModerationResult = ({ predictedLabel, confidence = 0, probabilities = {}, source = 'FALLBACK_RULE', modelType = 'RULE_BASED' }) => ({
    predictedLabel,
    labelName: LABEL_NAMES[predictedLabel] || 'clean',
    confidence,
    probabilities: {
        clean: Number(probabilities.clean || (predictedLabel === 0 ? confidence : 0)),
        offensive: Number(probabilities.offensive || (predictedLabel === 1 ? confidence : 0)),
        hate: Number(probabilities.hate || (predictedLabel === 2 ? confidence : 0)),
    },
    action: predictedLabel === 2 ? 'BAN_24H' : predictedLabel === 1 ? 'WARN' : 'ALLOW',
    source,
    modelType,
});

const fallbackModeration = (content) => {
    const text = normalizeText(content);

    if (GROUP_ATTACK_KEYWORDS.some((keyword) => text.includes(keyword))) {
        return buildModerationResult({ predictedLabel: 2, confidence: 0.9 });
    }

    if (OFFENSIVE_KEYWORDS.some((keyword) => text.includes(keyword))) {
        return buildModerationResult({ predictedLabel: 1, confidence: 0.75 });
    }

    return buildModerationResult({ predictedLabel: 0, confidence: 0.7 });
};

const applyRuleGuardrail = (content, aiResult) => {
    const ruleResult = fallbackModeration(content);
    if (ruleResult.predictedLabel <= aiResult.predictedLabel) {
        return aiResult;
    }

    return {
        ...ruleResult,
        source: `${aiResult.source || 'AI_MODEL'}+RULE_GUARDRAIL`,
        modelType: aiResult.modelType || 'TOXIC_CHAT_MODEL',
    };
};

export const moderateLiveChatMessage = async ({ content }) => {
    const aiServiceUrl = process.env.AI_SERVICE_URL;

    if (!aiServiceUrl) {
        return fallbackModeration(content);
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${aiServiceUrl.replace(/\/$/, '')}/toxic-chat/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return fallbackModeration(content);
        }

        const result = await response.json();
        const aiResult = buildModerationResult({
            predictedLabel: Number(result.predictedLabel || 0),
            confidence: Number(result.confidence || 0),
            probabilities: result.probabilities || {},
            source: result.source || 'AI_MODEL',
            modelType: result.modelType || 'TOXIC_CHAT_MODEL',
        });

        return applyRuleGuardrail(content, aiResult);
    } catch (error) {
        console.error('[LiveChatModeration] AI service unavailable, fallback rule-based:', error?.message);
        return fallbackModeration(content);
    }
};
