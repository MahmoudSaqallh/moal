"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { input, inspectView, keys, resetInput } from "@/lib/runtime";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { cancelNavigation, closeInspect, interact, openDirectory, selectLiftFloor } from "@/features/exploration/actions";
import { FLOOR_COUNT } from "@/data/floors";

const MOUSE_LOOK = 0.0022;
const TOUCH_LOOK = 0.0048;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** Recompute the analogue movement axes from held keys. */
function syncKeyAxes() {
  const f = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const s = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const t = (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
  input.forward = f;
  input.strafe = s;
  input.turn = t;
  input.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
}

/**
 * Keyboard, mouse, pointer-lock and touch-look bindings. They only write to the shared
 * `input` runtime; movement and camera code read it each frame.
 */
export function InputBindings() {
  const canvas = useThree((s) => s.gl.domElement);

  useEffect(() => {
    const store = useExperienceStore;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const { phase, panel, focused } = store.getState();

      if (e.code === "Escape") {
        if (phase === "inspect") closeInspect();
        else if (panel) store.getState().openPanel(null);
        else if (store.getState().autopilot) cancelNavigation();
        return;
      }
      if (panel) return; // dialogs own the keyboard while open

      if (phase === "inspect") {
        if (e.code === "ArrowLeft" || e.code === "KeyA") inspectView.yaw -= 0.35;
        if (e.code === "ArrowRight" || e.code === "KeyD") inspectView.yaw += 0.35;
        inspectView.lastInteraction = performance.now();
        return;
      }
      if (phase !== "explore") return;

      if (e.code === "KeyE" || e.code === "Enter") {
        if (e.target instanceof HTMLButtonElement) return; // let focused buttons handle Enter
        e.preventDefault();
        interact(focused);
        return;
      }
      if (e.code === "KeyV") {
        const s = useSettingsStore.getState();
        s.setCameraMode(s.cameraMode === "third" ? "first" : "third");
        return;
      }
      if (store.getState().inLift && /^Digit[1-9]$/.test(e.code)) {
        const floor = Number(e.code.slice(5)) - 1;
        if (floor < FLOOR_COUNT) selectLiftFloor(floor);
        return;
      }
      if (e.code === "KeyM") {
        e.preventDefault(); // otherwise the "m" lands in the directory search field
        openDirectory();
        return;
      }
      const movement = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"];
      if (movement.includes(e.code)) {
        if (e.code.startsWith("Arrow")) e.preventDefault(); // keep the page from scrolling
        keys.add(e.code);
        syncKeyAxes();
        if (store.getState().autopilot && e.code !== "ShiftLeft" && e.code !== "ShiftRight") cancelNavigation();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
      syncKeyAxes();
    };
    const onBlur = () => resetInput();

    // ── Pointer: drag-to-look, or pointer lock when enabled ──
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pointerId = -1;

    const onPointerDown = (e: PointerEvent) => {
      const { phase, panel } = store.getState();
      if (panel) return;
      input.dragDistance = 0;
      if (phase === "explore" && useSettingsStore.getState().pointerLock && e.pointerType === "mouse" && !input.pointerLocked) {
        canvas.requestPointerLock?.();
        return;
      }
      if (input.pointerLocked) {
        if (phase === "explore") interact(store.getState().focused);
        return;
      }
      if (phase !== "explore" && phase !== "inspect") return;
      dragging = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      inspectView.dragging = phase === "inspect";
    };
    const onPointerMove = (e: PointerEvent) => {
      const sens = useSettingsStore.getState().lookSensitivity;
      if (input.pointerLocked) {
        input.lookYaw += e.movementX * MOUSE_LOOK * sens;
        input.lookPitch += e.movementY * MOUSE_LOOK * sens;
        return;
      }
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      input.dragDistance += Math.abs(dx) + Math.abs(dy);
      const k = (e.pointerType === "touch" ? TOUCH_LOOK : MOUSE_LOOK) * sens;
      if (store.getState().phase === "inspect") {
        inspectView.yaw += dx * k * 1.6;
        inspectView.pitch = Math.max(-0.5, Math.min(0.6, inspectView.pitch + dy * k));
        inspectView.lastInteraction = performance.now();
        return;
      }
      // Drag the world: moving the pointer right turns the view left, like grabbing the scene.
      input.lookYaw -= dx * k;
      input.lookPitch -= dy * k;
      if (input.dragDistance > 6 && store.getState().autopilot) cancelNavigation();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = -1;
      inspectView.dragging = false;
    };
    const onLockChange = () => {
      input.pointerLocked = document.pointerLockElement === canvas;
      if (!input.pointerLocked) resetInput();
    };
    const onWheel = (e: WheelEvent) => {
      const phase = store.getState().phase;
      if (phase === "explore") {
        e.preventDefault();
        input.zoom += e.deltaY * 0.004;
        return;
      }
      if (phase !== "inspect") return;
      e.preventDefault();
      inspectView.zoom = Math.max(0.55, Math.min(1.6, inspectView.zoom * (1 + e.deltaY * 0.0012)));
      inspectView.lastInteraction = performance.now();
    };
    // Two-finger pinch zooms (touch).
    const touches = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const onTouchDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onTouchMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || !pinch) return;
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const delta = (pinch - d) * 0.02;
      pinch = d;
      if (store.getState().phase === "inspect") inspectView.zoom = Math.max(0.55, Math.min(1.6, inspectView.zoom * (1 + delta * 0.05)));
      else input.zoom += delta;
    };
    const onTouchUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = 0;
    };
    const onContext = (e: Event) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerdown", onTouchDown);
    window.addEventListener("pointermove", onTouchMove);
    window.addEventListener("pointerup", onTouchUp);
    window.addEventListener("pointercancel", onTouchUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContext);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerdown", onTouchDown);
      window.removeEventListener("pointermove", onTouchMove);
      window.removeEventListener("pointerup", onTouchUp);
      window.removeEventListener("pointercancel", onTouchUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContext);
      document.removeEventListener("pointerlockchange", onLockChange);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      resetInput();
    };
  }, [canvas]);

  return null;
}
