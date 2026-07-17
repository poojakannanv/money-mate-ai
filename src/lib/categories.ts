/**
 * UK-tuned transaction categories. This is the single source of truth:
 * the AI categoriser validates against it, the dashboard colours from it,
 * and the chat tools accept it as a filter.
 *
 * Kept dependency-free so it can be imported from both server and client code.
 */

export const CATEGORIES = [
  "Groceries",
  "Eating Out",
  "Transport (Tube and Rail)",
  "Transport (Car and Fuel)",
  "Utilities (Energy)",
  "Utilities (Water)",
  "Council Tax",
  "Internet and Mobile",
  "Rent and Mortgage",
  "Subscriptions",
  "Health and Pharmacy",
  "Shopping",
  "Entertainment",
  "Income",
  "Savings and Investments",
  "Transfers",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** Categories that are not "spending" for dashboard purposes. */
export const NON_SPEND_CATEGORIES: Category[] = [
  "Income",
  "Savings and Investments",
  "Transfers",
];

/** Stable colour palette for charts and badges, one per category. */
export const CATEGORY_COLOURS: Record<Category, string> = {
  Groceries: "#16a34a",
  "Eating Out": "#f97316",
  "Transport (Tube and Rail)": "#2563eb",
  "Transport (Car and Fuel)": "#0891b2",
  "Utilities (Energy)": "#eab308",
  "Utilities (Water)": "#38bdf8",
  "Council Tax": "#7c3aed",
  "Internet and Mobile": "#6366f1",
  "Rent and Mortgage": "#dc2626",
  Subscriptions: "#ec4899",
  "Health and Pharmacy": "#14b8a6",
  Shopping: "#d946ef",
  Entertainment: "#a855f7",
  Income: "#22c55e",
  "Savings and Investments": "#84cc16",
  Transfers: "#94a3b8",
  Other: "#64748b",
};

export function categoryColour(category: string | null): string {
  if (category && isCategory(category)) return CATEGORY_COLOURS[category];
  return CATEGORY_COLOURS.Other;
}
