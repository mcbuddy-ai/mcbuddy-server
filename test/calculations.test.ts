import { describe, expect, test } from "bun:test";
import { calculateAll } from "../src/features/tools/exact-calculations.tool";

describe("exact_calculations", () => {
  test("computes exactly, with BigNumbers", async () => {
    const results = await calculateAll(["0.1 + 0.2", "ceil(1000 / 64)", "-1024 / 8", "2^100", "64 * 27 * 36"]);
    expect(results.map((r) => ("result" in r ? r.result : r.error))).toEqual([
      "0.3", "16", "-128", "1267650600228229401496703205376", "62208",
    ]);
  });

  test("converts units", async () => {
    const [hours, distance] = await calculateAll(["3 hours to seconds", "5000 m to km"]);
    expect(hours).toEqual({ expression: "3 hours to seconds", result: "10800 seconds" });
    expect(distance).toEqual({ expression: "5000 m to km", result: "5 km" });
  });

  test("blocks functions that define code or units", async () => {
    const results = await calculateAll([
      'import({ x: 1 })', 'createUnit("blocks")', 'evaluate("1 + 1")', 'parse("1")', 'simplify("x + x")', "f(x) = x^2",
    ]);
    for (const result of results) expect("error" in result).toBe(true);
  });

  test("a runaway expression times out without taking the others down", async () => {
    const results = await calculateAll(["factorial(10^7)", "6 * 7"], 300);
    expect(results[0]).toMatchObject({ error: expect.stringContaining("longer than") });
    expect(results[1]).toEqual({ expression: "6 * 7", result: "42" });
  }, 20_000);
});
