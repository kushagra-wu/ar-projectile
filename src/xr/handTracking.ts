import * as THREE from 'three';

const JOINT_FINGER_TIPS = [
  'index-finger-tip',
  'middle-finger-tip',
  'ring-finger-tip',
  'pinky-finger-tip',
] as const;

const FIST_DISTANCE_M = 0.08; // every fingertip within 8 cm of the wrist = fist
const FIST_HOLD_MS = 400;
const FIST_COOLDOWN_MS = 1000;

interface HandFistState {
  closedSince: number | null;
}

/**
 * Detects a "closed fist" gesture on either hand by measuring each fingertip's distance to the wrist.
 * Requires the session to have been started with `hand-tracking` as a granted optional feature.
 *
 * Returns true (once) when a fist has been held for >= FIST_HOLD_MS, then enforces a cooldown.
 */
export class FistDetector {
  private leftState: HandFistState = { closedSince: null };
  private rightState: HandFistState = { closedSince: null };
  private lastFireAt = 0;
  private active = false;
  private wristVec = new THREE.Vector3();
  private tipVec = new THREE.Vector3();

  /** True if any input source in the current session exposes an XRHand. */
  get isActive(): boolean {
    return this.active;
  }

  /** Detects active hands from the session input sources. Should be called when sources change. */
  syncFromSession(session: XRSession): void {
    let anyHand = false;
    for (const src of session.inputSources) {
      if (src.hand) {
        anyHand = true;
        break;
      }
    }
    this.active = anyHand;
  }

  /**
   * Per-frame poll. If a fist gesture is confirmed (held >= 400ms) and we're outside the cooldown,
   * invokes `onFist` exactly once.
   */
  update(now: number, frame: XRFrame, session: XRSession, refSpace: XRReferenceSpace, onFist: () => void): void {
    if (!this.active) return;
    if (now - this.lastFireAt < FIST_COOLDOWN_MS) return;

    let fired = false;
    for (const src of session.inputSources) {
      if (!src.hand) continue;
      const state = src.handedness === 'left' ? this.leftState : this.rightState;
      const isClosed = this.handIsClosed(frame, src.hand, refSpace);
      if (isClosed) {
        if (state.closedSince === null) state.closedSince = now;
        else if (!fired && now - state.closedSince >= FIST_HOLD_MS) {
          this.lastFireAt = now;
          state.closedSince = null;
          fired = true;
          onFist();
        }
      } else {
        state.closedSince = null;
      }
    }
  }

  private handIsClosed(frame: XRFrame, hand: XRHand, refSpace: XRReferenceSpace): boolean {
    const wristJoint = hand.get('wrist');
    if (!wristJoint) return false;
    const wristPose = frame.getJointPose?.(wristJoint, refSpace);
    if (!wristPose) return false;
    this.wristVec.set(
      wristPose.transform.position.x,
      wristPose.transform.position.y,
      wristPose.transform.position.z,
    );
    for (const name of JOINT_FINGER_TIPS) {
      const joint = hand.get(name);
      if (!joint) return false;
      const pose = frame.getJointPose?.(joint, refSpace);
      if (!pose) return false;
      this.tipVec.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
      if (this.tipVec.distanceTo(this.wristVec) > FIST_DISTANCE_M) return false;
    }
    return true;
  }
}
