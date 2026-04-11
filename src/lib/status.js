export const STATUS = { LIVE:"live", CALCULATED:"calculated", PARTIAL:"partial", MANUAL:"manual", UNAVAILABLE:"unavailable" };
export function metric(value, formatted, status, source) { return { value, formatted, status, source }; }
