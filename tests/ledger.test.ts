import { test } from "node:test";
import assert from "node:assert/strict";
import { cents, totals, csv, flowByType, monthBalance, spaceCarryover, type Entry } from "../src/lib/ledger.ts";
test("money conversion is exact and rejects invalid amounts", () => {
  assert.equal(cents("18000.00"), 1800000);
  assert.equal(cents("0.29"), 29);
  for (const value of ["0", "-1", "1.001", "Infinity", "1e5", "NaN"])
    assert.throws(() => cents(value));
});
test("balances sum integer centavos across income and expense", () => {
  const base = {
    id: "a",
    date: "2026-09-10",
    particular: "Received from HRazon",
    subscription: "",
    receipt_name: null,
  };
  const rows: Entry[] = [
    { ...base, type: "credit", amount: 1800000 },
    { ...base, id: "b", type: "debit", amount: 115000 },
  ];
  assert.deepEqual(totals(rows), {
    credit: 1800000,
    debit: 115000,
    balance: 1685000,
  });
  assert.deepEqual(totals([]), { credit: 0, debit: 0, balance: 0 });
});
test("CSV escapes quotes and neutralizes spreadsheet formulas", () => {
  const result = csv([
    {
      id: "a",
      date: "2026-09-10",
      particular: '=HYPERLINK("x")',
      subscription: "Claude, Pro",
      type: "debit",
      amount: 100,
      receipt_name: null,
    },
  ]);
  assert.ok(result.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(result.includes('"Claude, Pro"'));
  assert.ok(result.includes('"1.00"'));
});
test("cash flow groups by transaction type, case-insensitively", () => {
  const base = {
    id: "a",
    date: "2026-09-10",
    particular: "x",
    receipt_name: null,
  };
  const rows: Entry[] = [
    { ...base, subscription: "Salary", type: "credit", amount: 1800000 },
    { ...base, subscription: "Food", type: "debit", amount: 50000 },
    { ...base, subscription: "food", type: "debit", amount: 25000 },
    { ...base, subscription: "Food", type: "credit", amount: 10000 },
    { ...base, subscription: "", type: "debit", amount: 1000 },
  ];
  assert.deepEqual(flowByType(rows), [
    { name: "Salary", credit: 1800000, debit: 0, net: 1800000 },
    { name: "Food", credit: 10000, debit: 75000, net: -65000 },
    { name: "Uncategorized", credit: 0, debit: 1000, net: -1000 },
  ]);
  assert.deepEqual(flowByType([]), []);
});
test("month balance carries over what was left from earlier months", () => {
  const base = { id: "a", particular: "x", subscription: "", receipt_name: null };
  const rows: Entry[] = [
    { ...base, date: "2026-09-01", type: "credit", amount: 2000000 },
    { ...base, date: "2026-09-20", type: "debit", amount: 500000 },
    { ...base, date: "2026-10-15", type: "debit", amount: 300000 },
    { ...base, date: "2026-11-01", type: "credit", amount: 100000 },
    { ...base, date: "2026-11-02", type: "debit", amount: 50000 },
  ];
  assert.deepEqual(monthBalance(rows, "2026-11"), {
    carryover: 1200000,
    credit: 100000,
    debit: 50000,
    ending: 1250000,
  });
  assert.deepEqual(monthBalance(rows, "2026-09"), {
    carryover: 0,
    credit: 2000000,
    debit: 500000,
    ending: 1500000,
  });
  // Negative carryover (overspent) carries over too.
  assert.equal(
    monthBalance([{ ...base, date: "2026-10-01", type: "debit", amount: 100 }], "2026-11").carryover,
    -100,
  );
});
test("a Budget Space carries over what was left in earlier spaces", () => {
  const base = { id: "a", particular: "x", subscription: "", receipt_name: null };
  const spaces = [
    { id: "p", name: "Personal" },
    { id: "oct", name: "October" },
    { id: "nov", name: "November Expense" },
  ];
  const rows: Entry[] = [
    { ...base, space_id: "oct", date: "2026-10-01", type: "credit", amount: 10700000 },
    { ...base, space_id: "oct", date: "2026-10-20", type: "debit", amount: 8217133 },
    { ...base, space_id: "nov", date: "2026-11-02", type: "debit", amount: 6271745 },
  ];
  assert.deepEqual(spaceCarryover(spaces, rows, "p"), { amount: 0, from: null });
  const carried = spaceCarryover(spaces, rows, "nov");
  assert.deepEqual(carried, { amount: 2482867, from: "October" });
  const nov = monthBalance(
    rows.filter((e) => e.space_id === "nov"),
    "2026-11",
    carried.amount,
  );
  assert.deepEqual(nov, {
    carryover: 2482867,
    credit: 0,
    debit: 6271745,
    ending: 2482867 - 6271745,
  });
});
