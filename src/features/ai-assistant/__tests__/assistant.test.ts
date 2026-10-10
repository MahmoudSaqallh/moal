import { describe, expect, it } from "vitest";
import { localAnswer } from "../localAssistant";
import { directions, nearestFacility, searchProducts, searchStores } from "../knowledge";
import { getProduct } from "@/data/products";

const atrium = { x: 0, z: 13.5, floor: 0 };

describe("mall knowledge", () => {
  it("finds stores by category and floor from real data", () => {
    expect(searchStores({ category: "technology" }).map((s) => s.id)).toEqual(["lumen"]);
    expect(searchStores({ floor: 2 }).every((s) => s.floor === 2)).toBe(true);
  });

  it("filters products by price using catalogue prices", () => {
    const shoes = searchProducts({ category: "footwear", maxPriceUsd: 100 });
    expect(shoes.length).toBeGreaterThan(0);
    for (const p of shoes) expect(getProduct(p.id)!.priceCents).toBeLessThanOrEqual(10000);
  });

  it("gives walking directions across levels", () => {
    const d = directions(atrium, "atrium-roasters")!;
    expect(d.floor).toBe(2);
    expect(d.steps.some((s) => /escalator|lift/i.test(s))).toBe(true);
  });

  it("finds the nearest lift by route on the visitor's level", () => {
    expect(nearestFacility(atrium, "lift")?.destinationId).toBe("lift-0");
    expect(nearestFacility({ x: 0, z: 13.5, floor: 2 }, "lift")?.destinationId).toBe("lift-2");
  });
});

describe("offline assistant (English + Arabic)", () => {
  it("answers where a store is", () => {
    const r = localAnswer("Where is the electronics store?", atrium);
    expect(r.reply).toMatch(/Lumen/);
    expect(r.actions[0]).toMatchObject({ type: "route", destinationId: "lumen" });
  });

  it("starts navigation when asked to be taken somewhere", () => {
    const r = localAnswer("Take me to the sneaker store", atrium);
    expect(r.actions[0]).toMatchObject({ type: "navigate", destinationId: "stride" });
  });

  it("leads with sit-down restaurants when asked for restaurants", () => {
    const r = localAnswer("Take me to the restaurants", atrium);
    expect(r.actions[0]).toMatchObject({ type: "navigate" });
    expect(["saffron-table", "umami-street"]).toContain((r.actions[0] as { destinationId: string }).destinationId);
  });

  it("lists products under a budget", () => {
    const r = localAnswer("Show me shoes under $100", atrium);
    expect(r.actions[0].type).toBe("products");
  });

  it("understands Arabic requests", () => {
    expect(localAnswer("وين المطاعم؟", atrium).reply).toMatch(/الطابق 3/);
    expect(localAnswer("أقرب مصعد", atrium).actions[0]).toMatchObject({ destinationId: "lift-0" });
    expect(localAnswer("خذني لمتجر الأحذية", atrium).actions[0]).toMatchObject({ type: "navigate", destinationId: "stride" });
    expect(localAnswer("أحذية أقل من ١٠٠ دولار", atrium).actions[0].type).toBe("products");
  });

  it("never invents a destination", () => {
    const r = localAnswer("Take me to the cinema on level 9", atrium);
    for (const a of r.actions) if ("destinationId" in a) expect(["lumen", "stride"]).not.toContain("cinema");
  });
});
