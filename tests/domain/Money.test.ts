import { describe, expect, it } from "vitest";
import { Money, formatSignedCents } from "@/domain/Money";

describe("Money", () => {
  it.each([
    ["60", 6000],
    ["$60", 6000],
    ["60.5", 6050],
    ["60.05", 6005],
    ["1,200.00", 120000],
    ["60$", 6000],
    ["60 USD", 6000],
    [" 8 ", 800],
  ])("reads %s as %i cents", (text, cents) => {
    expect(Money.parse(text)?.cents).toBe(cents);
  });

  it.each(["", "sixty", "-5", "60.555", "1,20", "$"])("rejects %j", (text) => {
    expect(Money.parse(text)).toBeNull();
  });

  it("writes PayPal's format and a display format", () => {
    const amount = Money.ofCents(12805);
    expect(amount.toPayPalValue()).toBe("128.05");
    expect(Money.ofCents(800).toPayPalValue()).toBe("8.00");
    expect(amount.format()).toBe("$128.05");
  });

  it("reads PayPal's amounts back exactly", () => {
    expect(Money.fromPayPalValue("128.00").cents).toBe(12800);
    expect(Money.fromPayPalValue("0.5").cents).toBe(50);
    expect(() => Money.fromPayPalValue("12.345")).toThrow();
  });

  it("adds and multiplies in whole cents", () => {
    expect(Money.ofCents(6000).times(2).plus(Money.ofCents(800)).cents).toBe(12800);
    expect(() => Money.ofCents(1.5)).toThrow();
    expect(() => Money.ofCents(-1)).toThrow();
  });

  it("formats signed timeline amounts", () => {
    expect(formatSignedCents(12800)).toBe("+$128.00");
    expect(formatSignedCents(-12800)).toBe("−$128.00");
  });
});
