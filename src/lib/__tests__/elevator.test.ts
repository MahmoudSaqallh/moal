import { describe, expect, it } from "vitest";
import { createLift, liftAccess, requestFloor, stepLift } from "@/lib/elevator";
import { floorY } from "@/data/floors";
import { ELEVATOR } from "@/data/layout";

const run = (s: ReturnType<typeof createLift>, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) stepLift(s, 1 / 60);
};

describe("lift", () => {
  it("opens its doors when called on the floor it is already on", () => {
    const s = createLift(0);
    requestFloor(s, 0);
    run(s, 1.2);
    expect(s.doorState).toBe("open");
  });

  it("travels to a requested floor, stops exactly and opens", () => {
    const s = createLift(0);
    requestFloor(s, 2);
    run(s, 10);
    expect(s.y).toBeCloseTo(floorY(2), 5);
    expect(s.floor).toBe(2);
    expect(s.velocity).toBe(0);
    expect(["opening", "open"]).toContain(s.doorState);
  });

  it("never moves with its doors open", () => {
    const s = createLift(0);
    requestFloor(s, 0); // open here first
    run(s, 1.2);
    requestFloor(s, 1);
    const y = s.y;
    run(s, 2); // still dwelling
    expect(s.y).toBe(y);
  });

  it("serves stops in request order", () => {
    const s = createLift(0);
    requestFloor(s, 2);
    requestFloor(s, 1);
    run(s, 40);
    expect(s.floor).toBe(1);
  });

  it("keeps the doors open while the doorway is blocked", () => {
    const s = createLift(0);
    requestFloor(s, 0);
    run(s, 1.2);
    s.blocked = true;
    run(s, 10);
    expect(s.doorState).toBe("open");
  });

  it("reports shaft access for collision", () => {
    const s = createLift(1);
    const { x, z } = ELEVATOR.call;
    expect(liftAccess(s, 0, x, z)).toBe("closed");
    requestFloor(s, 1);
    run(s, 1.2);
    expect(liftAccess(s, 1, x, z)).toBe("open");
    const cx = (ELEVATOR.cabin.minX + ELEVATOR.cabin.maxX) / 2;
    s.doorState = "closing";
    run(s, 1.2);
    expect(liftAccess(s, 1, cx, ELEVATOR.z)).toBe("riding");
  });
});
