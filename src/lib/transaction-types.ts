export const DEFAULT_TYPES = ["Salary", "Food", "Travel", "Transport", "Bills", "Shopping", "ChatGPT", "Claude"];
export const TYPE_ICONS = ["tag", "food", "travel", "transport", "home", "shopping", "salary", "bills", "coffee", "health", "education", "gift", "tech"] as const;
export function defaultIcon(name: string) {
  return ({ food: "food", travel: "travel", transport: "transport", salary: "salary", bills: "bills", shopping: "shopping", chatgpt: "tech", claude: "tech" } as Record<string,string>)[name.toLowerCase()] || "tag";
}
