import { describe, expect, it } from "vitest";
import { InvalidDetailValue, OptionsNotAllowed } from "@/domain/errors";
import { OrderDetail } from "@/domain/OrderDetail";
import { DetailStatus, ItemField, OrderField } from "@/domain/types";

const found = (value: string, quote = value) => ({ value, status: "found" as const, quote });

describe("OrderDetail", () => {
  it("fills in from an AI reading with its source quote", () => {
    const size = OrderDetail.missing(ItemField.Size);
    expect(size.applyReading(found("M", "medium please"))).toBe(true);
    expect(size.snapshot()).toMatchObject({
      value: "M",
      status: DetailStatus.Found,
      sourceQuote: "medium please",
    });
  });

  it("never lets a reading overwrite what the seller set", () => {
    const price = OrderDetail.missing(ItemField.UnitPrice);
    price.setBySeller("60");
    expect(price.applyReading(found("75"))).toBe(false);
    expect(price.value).toBe("60.00");
    expect(price.status).toBe(DetailStatus.SetByYou);
  });

  it("treats a value that isn't valid for its field as missing", () => {
    const price = OrderDetail.missing(ItemField.UnitPrice);
    price.applyReading(found("sixty dollars"));
    expect(price.isOpen).toBe(true);
    const quantity = OrderDetail.missing(ItemField.Quantity);
    quantity.applyReading(found("0"));
    expect(quantity.isOpen).toBe(true);
  });

  it("normalizes what the seller types and rejects nonsense", () => {
    const fee = OrderDetail.missing(OrderField.DeliveryFee);
    fee.setBySeller("$8");
    expect(fee.value).toBe("8.00");
    expect(fee.money?.cents).toBe(800);
    expect(() => OrderDetail.missing(ItemField.Quantity).setBySeller("lots")).toThrow(InvalidDetailValue);
  });

  it("reads quantities written the way people chat: 'one', 'a', 'two', '2 dresses'", () => {
    const read = (words: string) => {
      const quantity = OrderDetail.missing(ItemField.Quantity);
      quantity.applyReading(found(words));
      return quantity.value;
    };
    expect([read("one"), read("a"), read("Two"), read("2 dresses"), read("1000")]).toEqual([
      "1",
      "1",
      "2",
      "2",
      null,
    ]);
  });

  it("offers up to 3 options, never for a price", () => {
    const size = OrderDetail.missing(ItemField.Size);
    size.askCustomer([" S", "M ", "M"]);
    expect(size.offeredOptions).toEqual(["S", "M"]);
    expect(() => size.askCustomer(["S", "M", "L", "XL"])).toThrow(OptionsNotAllowed);
    expect(() => OrderDetail.missing(ItemField.UnitPrice).askCustomer(["50", "60"])).toThrow(
      OptionsNotAllowed,
    );
  });

  it("accepts only an offered option as the customer's answer", () => {
    const size = OrderDetail.missing(ItemField.Size);
    size.askCustomer(["S", "M"]);
    expect(size.answerFromCustomer("XL", "XL")).toBe(false);
    expect(size.answerFromCustomer("M", "M")).toBe(true);
    expect(size.snapshot()).toMatchObject({ value: "M", status: DetailStatus.Found, offeredOptions: [] });
  });
});
