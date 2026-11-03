export interface PointerDelta {
  x: number;
  y: number;
}

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();

  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  private pointerDeltaX = 0;
  private pointerDeltaY = 0;
  private wheelDelta = 0;

  private readonly movementKeys = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ShiftLeft',
    'ShiftRight',
  ]);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerEnd);
    canvas.addEventListener('pointercancel', this.handlePointerEnd);
    canvas.addEventListener('wheel', this.handleWheel, {
      passive: false,
    });
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  get horizontalAxis(): number {
    const right = this.keys.has('KeyD') ? 1 : 0;
    const left = this.keys.has('KeyA') ? 1 : 0;

    return right - left;
  }

  get verticalAxis(): number {
    const forward = this.keys.has('KeyW') ? 1 : 0;
    const backward = this.keys.has('KeyS') ? 1 : 0;

    return forward - backward;
  }

  get isSprinting(): boolean {
    return (
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight')
    );
  }

  consumePointerDelta(): PointerDelta {
    const delta = {
      x: this.pointerDeltaX,
      y: this.pointerDeltaY,
    };

    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;

    return delta;
  }

  consumeWheelDelta(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;

    return delta;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerEnd);
    this.canvas.removeEventListener('pointercancel', this.handlePointerEnd);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

    this.keys.clear();
    this.activePointerId = null;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.movementKeys.has(event.code)) return;

    this.keys.add(event.code);
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handleBlur = (): void => {
    this.keys.clear();
    this.activePointerId = null;
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const isTouch = event.pointerType === 'touch';
    const isRightMouseButton =
      event.pointerType === 'mouse' && event.button === 2;

    if (!isTouch && !isRightMouseButton) return;

    event.preventDefault();

    this.activePointerId = event.pointerId;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;

    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;

    this.pointerDeltaX += event.clientX - this.lastPointerX;
    this.pointerDeltaY += event.clientY - this.lastPointerY;

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;

    this.activePointerId = null;

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    this.wheelDelta += event.deltaY;
    event.preventDefault();
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
