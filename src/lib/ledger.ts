export type Entry = {
  space_id?: string;
  id: string;
  date: string;
  particular: string;
  subscription: string;
  type: "credit" | "debit";
  amount: number;
  receipt_name: string | null;
};
export function cents(value: string) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (result <= 0) throw new Error("Amount must be greater than zero.");
  return result;
}
export function totals(entries: Entry[]) {
  const credit = entries
    .filter((e) => e.type === "credit")
    .reduce((s, e) => s + e.amount, 0);
  const debit = entries
    .filter((e) => e.type === "debit")
    .reduce((s, e) => s + e.amount, 0);
  return { credit, debit, balance: credit - debit };
}
export function csv(entries: Entry[]) {
  const cell = (v: string) =>
    `"${(/^[=+@\-\t\r]/.test(v) ? "'" : "") + v.replaceAll('"', '""')}"`;
  return [
    "Date,Particular,Transaction type,Credit,Debit,Receipt",
    ...entries.map((e) =>
      [
        e.date,
        e.particular,
        e.subscription,
        e.type === "credit" ? (e.amount / 100).toFixed(2) : "",
        e.type === "debit" ? (e.amount / 100).toFixed(2) : "",
        e.receipt_name || "",
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
export type TypeFlow = {
  name: string;
  credit: number;
  debit: number;
  net: number;
};
// Cash flow grouped by transaction type (Salary, Food, ...). Names match
// case-insensitively; untyped entries are grouped under "Uncategorized".
export function flowByType(entries: Entry[]): TypeFlow[] {
  const groups = new Map<string, TypeFlow>();
  for (const e of entries) {
    const name = e.subscription.trim() || "Uncategorized";
    const key = name.toLowerCase();
    const g = groups.get(key) || { name, credit: 0, debit: 0, net: 0 };
    if (e.type === "credit") g.credit += e.amount;
    else g.debit += e.amount;
    g.net = g.credit - g.debit;
    groups.set(key, g);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.credit + b.debit - (a.credit + a.debit) || a.name.localeCompare(b.name),
  );
}
export type MonthBalance = {
  carryover: number;
  credit: number;
  debit: number;
  ending: number;
};
// Opening balance for a month ("YYYY-MM") is everything left over from
// earlier months; ending balance adds that month's credits minus debits.
// `opening` is money carried in from outside these entries, such as an
// earlier Budget Space.
export function monthBalance(
  entries: Entry[],
  month: string,
  opening = 0,
): MonthBalance {
  const carryover =
    opening +
    totals(entries.filter((e) => e.date.slice(0, 7) < month)).balance;
  const { credit, debit } = totals(
    entries.filter((e) => e.date.startsWith(month)),
  );
  return { carryover, credit, debit, ending: carryover + credit - debit };
}
// A Budget Space starts with whatever was left in the spaces created before
// it (spaces are listed oldest first). Chaining each space's ending balance
// into the next equals the sum of all earlier spaces' balances.
export function spaceCarryover(
  spaces: { id: string; name: string }[],
  entries: Entry[],
  spaceId: string,
) {
  const index = spaces.findIndex((s) => s.id === spaceId);
  if (index <= 0) return { amount: 0, from: null as string | null };
  const earlier = new Set(spaces.slice(0, index).map((s) => s.id));
  return {
    amount: totals(entries.filter((e) => earlier.has(e.space_id || ""))).balance,
    from: spaces[index - 1].name,
  };
}
