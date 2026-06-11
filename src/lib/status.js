export const STATUS = { LIVE:"live", CALCULATED:"calculated", PARTIAL:"partial", STATIC:"static", MANUAL:"manual", UNAVAILABLE:"unavailable" };
export function metric(value, formatted, status, source) { return { value, formatted, status, source }; }
