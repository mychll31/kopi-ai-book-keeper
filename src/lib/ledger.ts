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
