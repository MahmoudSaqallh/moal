"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ESCALATORS } from "@/data/layout";
import { FLOOR_HEIGHT, floorY } from "@/data/floors";
import { autopilot, cancelAutopilot, input, player } from "@/lib/runtime";
import { moveWithCollision } from "@/lib/collision";
import { angleDelta } from "@/lib/space";
import { inCabin, lift, liftAccess, requestFloor } from "@/lib/elevator";
import { ESCALATOR_SPEED, laneGeometry, laneHeightAt, type LaneGeometry } from "@/lib/transit";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { callLift, cancelNavigation, selectLiftFloor } from "@/features/exploration/actions";

const WALK = 2.4;
const RUN = 5.0;
const GUIDED = 2.4;
const ACCEL = 9;
const DECEL = 11;
const LANES: LaneGeometry[] = ESCALATORS.flatMap((e) => [laneGeometry(e, "up"), laneGeometry(e, "down")]);

let settleYaw: number | null = null;

const store = () => useExperienceStore.getState();

function setFloor(floor: number) {
  if (player.floor === floor) return;
  player.floor = floor;
  store().setFloor(floor);
}

function startRide(lane: LaneGeometry) {
  player.ride = { lane, x: player.x };
  player.mode = "escalator";
  player.vx = 0;
  player.vz = 0;
}

/** Escalator: carry the rider along the lane; step off at the far landing. */
function advanceRide(dt: number) {
  const r = player.ride!;
  const lane = r.lane;
  r.x += lane.dirX * ESCALATOR_SPEED * dt;
  player.x = r.x;
  player.z = THREE.MathUtils.damp(player.z, lane.entry.z, 10, dt);
  player.y = laneHeightAt(lane, r.x);
  player.yaw += angleDelta(player.yaw, lane.dirX > 0 ? -Math.PI / 2 : Math.PI / 2) * (1 - Math.exp(-10 * dt));
  player.speed = 0;
  // The floor index follows the rider's height so zones and focus update mid-ride.
  const f = Math.round(player.y / FLOOR_HEIGHT);
  if (Math.abs(player.y - floorY(f)) < 0.5) setFloor(f);
  if ((r.x - lane.exit.x) * lane.dirX >= 0) {
    player.x = lane.exit.x;
    player.y = floorY(lane.exit.floor);
    setFloor(lane.exit.floor);
    player.ride = null;
    player.mode = "walk";
  }
}

/** Keep the avatar attached to the lift cabin; switch floors when it arrives. */
function coupleToLift() {
  const onCabin = inCabin(player.x, player.z) && Math.abs(player.y - lift.y) < 0.8 && !player.ride;
  if (onCabin) {
    player.y = lift.y;
    const travelling = lift.velocity !== 0 || lift.doors < 0.8;
    player.mode = travelling ? "elevator" : "walk";
    if (lift.velocity === 0 && Math.abs(lift.y - floorY(lift.floor)) < 0.01) setFloor(lift.floor);
  } else if (player.mode === "elevator") {
    player.mode = "walk";
  }
  if (store().inLift !== onCabin) store().setInLift(onCabin);
}

interface Wish {
  x: number;
  z: number;
  speed: number;
}

function towards(tx: number, tz: number, arrive: boolean): Wish & { dist: number } {
  const dx = tx - player.x;
  const dz = tz - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-4) return { x: 0, z: 0, speed: 0, dist };
  const speed = arrive ? Math.min(GUIDED, 0.4 + dist * 1.6) : GUIDED;
  return { x: dx / dist, z: dz / dist, speed, dist };
}

/** One autopilot step along the active route. Returns the desired movement. */
function autopilotStep(): Wish {
  const ap = autopilot.state!;
  const leg = ap.legs[ap.legIndex];
  const none = { x: 0, z: 0, speed: 0 };
  if (!leg) {
    settleYaw = ap.finalYaw;
    const done = ap.onArrive;
    cancelAutopilot();
    done?.();
    return none;
  }
  const nextLeg = () => {
    ap.legIndex++;
    ap.pointIndex = 1;
    ap.liftStep = "approach";
    store().setRouteLeg(ap.legIndex);
  };

  if (leg.transit.type === "walk") {
    const target = leg.points[ap.pointIndex];
    if (!target) {
      nextLeg();
      return none;
    }
    const finalPoint = ap.legIndex === ap.legs.length - 1 && ap.pointIndex === leg.points.length - 1;
    const w = towards(target.x, target.z, finalPoint);
    if (w.dist < (finalPoint ? 0.12 : 0.45)) ap.pointIndex++;
    return w;
  }

  if (leg.transit.type === "escalator") {
    if (player.ride) return none;
    const exit = leg.points[3];
    if (player.floor === exit.floor && Math.hypot(player.x - exit.x, player.z - exit.z) < 1.2) {
      nextLeg();
      return none;
    }
    const entry = leg.points[0];
    const w = towards(entry.x, entry.z, false);
    if (w.dist < 0.3) {
      const lane = LANES.find((l) => l.escalatorId === (leg.transit as { escalatorId: string }).escalatorId && l.direction === (leg.transit as { direction: string }).direction);
      if (lane) startRide(lane);
      return none;
    }
    return w;
  }

  // Lift: approach → call and wait → board → ride → step out.
  const [call, cabin, , out] = leg.points;
  const toFloor = leg.transit.toFloor;
  switch (ap.liftStep) {
    case "approach": {
      const w = towards(call.x, call.z, true);
      if (w.dist < 0.25) {
        callLift(player.floor);
        ap.liftStep = "wait";
      }
      return w;
    }
    case "wait":
      if (liftAccess(lift, player.floor, call.x, call.z) === "open") ap.liftStep = "board";
      else if (!lift.queue.includes(player.floor) && lift.velocity === 0 && lift.doorState === "closed") requestFloor(lift, player.floor);
      return none;
    case "board": {
      const w = towards(cabin.x, cabin.z, true);
      if (w.dist < 0.2 && inCabin(player.x, player.z)) {
        selectLiftFloor(toFloor);
        ap.liftStep = "ride";
      }
      return w;
    }
    case "ride":
      if (player.floor === toFloor && lift.velocity === 0 && lift.doors > 0.85) ap.liftStep = "exit";
      return none;
    case "exit": {
      const w = towards(out.x, out.z, false);
      if (w.dist < 0.4) nextLeg();
      return w;
    }
  }
}

/**
 * Character movement only: integrates input or autopilot into the `player` runtime with
 * smooth acceleration, collision sliding and vertical transport. It never touches the camera.
 */
export function PlayerController() {
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const phase = store().phase;
    const firstPerson = useSettingsStore.getState().cameraMode === "first";

    // Camera orbit / look (consumed even while riding so the visitor can look around).
    if (phase === "explore") {
      player.camYaw -= input.lookYaw;
      player.camYaw += input.turn * 1.9 * dt;
      const minPitch = firstPerson ? -1.25 : -0.35;
      const maxPitch = firstPerson ? 1.25 : 1.0;
      player.camPitch = THREE.MathUtils.clamp(player.camPitch + (firstPerson ? -input.lookPitch : input.lookPitch), minPitch, maxPitch);
      player.camDistance = THREE.MathUtils.clamp(player.camDistance + input.zoom, 2.2, 7.5);
      if (input.lookYaw !== 0 || input.turn !== 0) settleYaw = null;
    }
    input.lookYaw = 0;
    input.lookPitch = 0;
    input.zoom = 0;

    coupleToLift();

    if (player.ride) {
      advanceRide(dt);
      return;
    }
    if (phase !== "explore") {
      player.vx = 0;
      player.vz = 0;
      player.speed = 0;
      return;
    }

    let wish: Wish = { x: 0, z: 0, speed: WALK };
    if (autopilot.state) {
      const manual = input.forward !== 0 || input.strafe !== 0;
      if (manual) cancelNavigation();
      else wish = autopilotStep();
    }
    if (!autopilot.state && !player.ride) {
      if (settleYaw !== null) {
        const d = angleDelta(player.camYaw, settleYaw);
        player.camYaw += d * (1 - Math.exp(-4 * dt));
        if (Math.abs(d) < 0.002) settleYaw = null;
      }
      // Camera-relative movement.
      const sin = Math.sin(player.camYaw);
      const cos = Math.cos(player.camYaw);
      let wx = -sin * input.forward + cos * input.strafe;
      let wz = -cos * input.forward - sin * input.strafe;
      const len = Math.hypot(wx, wz);
      if (len > 1) {
        wx /= len;
        wz /= len;
      }
      wish = { x: wx, z: wz, speed: input.sprint ? RUN : WALK };
    }
    if (player.ride) return;

    const rate = wish.x || wish.z ? ACCEL : DECEL;
    player.vx = THREE.MathUtils.damp(player.vx, wish.x * wish.speed, rate, dt);
    player.vz = THREE.MathUtils.damp(player.vz, wish.z * wish.speed, rate, dt);
    const access = player.mode === "elevator" ? "riding" : liftAccess(lift, player.floor, player.x, player.z);
    if (player.mode === "elevator") {
      player.vx = 0;
      player.vz = 0;
    }
    if (Math.abs(player.vx) > 1e-3 || Math.abs(player.vz) > 1e-3) {
      const next = moveWithCollision(player.floor, { x: player.x, z: player.z }, player.vx * dt, player.vz * dt, { lift: access });
      player.vx = (next.x - player.x) / dt;
      player.vz = (next.z - player.z) / dt;
      player.x = next.x;
      player.z = next.z;
    }
    player.speed = Math.hypot(player.vx, player.vz);
    if (player.mode === "walk" && !inCabin(player.x, player.z)) player.y = floorY(player.floor);

    // Face the direction of travel (third person) or the view direction (first person).
    if (firstPerson) {
      player.yaw = player.camYaw;
    } else if (player.speed > 0.15) {
      const travelYaw = Math.atan2(-player.vx, -player.vz);
      player.yaw += angleDelta(player.yaw, travelYaw) * (1 - Math.exp(-10 * dt));
    }
    // Guided walking turns the camera gently behind the avatar.
    if (autopilot.state && player.speed > 0.3) player.camYaw += angleDelta(player.camYaw, player.yaw) * (1 - Math.exp(-1.5 * dt));

    // Step onto an escalator lane by walking into it in its direction of travel.
    if (!autopilot.state && player.speed > 0.4) {
      for (const lane of LANES) {
        if (lane.entry.floor !== player.floor) continue;
        const near = Math.hypot(player.x - lane.entry.x, player.z - lane.entry.z) < 0.55;
        if (near && (player.vx * lane.dirX) / player.speed > 0.6) {
          startRide(lane);
          break;
        }
      }
    }
  });
  return null;
}

export { LANES };
