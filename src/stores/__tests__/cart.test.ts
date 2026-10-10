import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LINE_QUANTITY, cartTotals, lineKey, useCartStore } from "@/stores/useCartStore";

const cart = () => useCartStore.getState();

describe("demo cart", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [], lastOrder: null, addedPulse: 0 });
  });

  it("merges identical product variants into one line", () => {
    cart().add("lumen-aero-phone", "glacier", "256 GB");
    cart().add("lumen-aero-phone", "glacier", "256 GB", 2);
    expect(cart().lines).toHaveLength(1);
    expect(cart().lines[0].quantity).toBe(3);
    expect(cart().addedPulse).toBe(2);
  });

  it("keeps different variants on separate lines", () => {
    cart().add("lumen-aero-phone", "glacier", "256 GB");
    cart().add("lumen-aero-phone", "graphite", "256 GB");
    expect(cart().lines.map((l) => l.key)).toEqual([
      lineKey("lumen-aero-phone", "glacier", "256 GB"),
      lineKey("lumen-aero-phone", "graphite", "256 GB"),
    ]);
  });

  it("rejects unknown products, colours and sizes", () => {
    cart().add("does-not-exist", "x");
    cart().add("lumen-aero-phone", "neon-pink");
    cart().add("lumen-aero-phone", "glacier", "1 PB");
    expect(cart().lines).toHaveLength(0);
  });

  it("clamps quantities and removes lines set to zero", () => {
    cart().add("stride-court-low", "white", "UK 8", 50);
    const key = cart().lines[0].key;
    expect(cart().lines[0].quantity).toBe(MAX_LINE_QUANTITY);
    cart().setQuantity(key, 0);
    expect(cart().lines).toHaveLength(0);
  });

  it("totals in integer cents", () => {
    cart().add("roasters-house-blend", "kraft", "Whole bean", 3); // 3 × 1800
    cart().add("roasters-ceramic-mug", "clay"); // 2600
    expect(cartTotals(cart().lines)).toEqual({ count: 4, subtotalCents: 8000 });
  });

  it("requires and prices a full configuration for configurable products", () => {
    expect(cart().add("stride-arc-runner", "bone", "UK 8")).toBe(false);
    const base = { upper: "clay", material: "knit", sole: "gum", laces: "white" };
    expect(cart().add("stride-arc-runner", "bone", "UK 8", 1, { ...base, material: "velvet" })).toBe(false);
    expect(cart().add("stride-arc-runner", "bone", "UK 8", 1, base)).toBe(true);
    expect(cart().add("stride-arc-runner", "bone", "UK 8", 1, { ...base, material: "leather" })).toBe(true);
    expect(cart().lines).toHaveLength(2);
    // 19000 + (19000 + 2000 leather)
    expect(cartTotals(cart().lines).subtotalCents).toBe(40000);
  });

  it("places a demo order that empties the cart", () => {
    cart().add("aurelia-arc-bag", "cognac");
    const order = cart().placeDemoOrder();
    expect(order?.totalCents).toBe(245000);
    expect(order?.reference).toMatch(/^MV-/);
    expect(cart().lines).toHaveLength(0);
    expect(cart().placeDemoOrder()).toBeNull();
  });
});
