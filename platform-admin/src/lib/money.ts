export const money = (n: number) =>
  `₹ ${Math.round(n || 0).toLocaleString("en-IN")}`
