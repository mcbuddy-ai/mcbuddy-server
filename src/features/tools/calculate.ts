import { all, create } from "mathjs";

/** math.js with BigNumbers, so 0.1 + 0.2 is 0.3 and big totals keep every digit. */
const math = create(all, { number: "BigNumber", precision: 64 });

// The math.js security guide: switch off what can define code, units, or parse new expressions,
// so an expression can only compute. `evaluate` is kept as a local before it goes.
const evaluate = math.evaluate;
const disabled = (name: string) => () => {
  throw new Error(`${name} is disabled`);
};
math.import(
  Object.fromEntries(
    [
      "import", "createUnit", "reviver", "evaluate", "parse", "parser", "compile", "chain", "help",
      "simplify", "simplifyConstant", "simplifyCore", "derivative", "resolve", "rationalize",
    ].map((name) => [name, disabled(name)]),
  ),
  { override: true },
);

const MAX_RESULT = 500;

/** One expression to a printable result; throws with math.js's message when it can't. */
export const calculate = (expression: string): string => {
  const value = evaluate(expression);
  if (typeof value === "function") throw new Error("the expression defines a function instead of computing a value");
  // Up to 32 significant digits: exact for anything a player counts, readable in chat.
  const text = math.format(value, { precision: 32, lowerExp: -12, upperExp: 33 });
  return text.length > MAX_RESULT ? `${text.slice(0, MAX_RESULT)}…` : text;
};
