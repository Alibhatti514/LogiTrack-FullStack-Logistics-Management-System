export const number = (n: number) => n.toLocaleString();
export const date = (s: string) =>
  new Date(s.endsWith("Z") ? s : s + "Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
