import { InputState } from './types';

export class InputManager {
  public state: InputState = {
    pointer: { x: 0, y: 0 },
    fire: false,
    select: null,
    move: { x: 0, y: 0 },
    isMobile: false,
  };

  private canvas: HTMLCanvasElement | null = null;
  private onFireCallback: (() => void) | null = null;
  private onSelectCallback: ((key: 'A' | 'B' | 'C' | 'D') => void) | null = null;

  setup(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.state.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (this.state.isMobile) {
      this.setupMobileListeners();
    } else {
      this.setupPCListeners();
    }
  }

  private setupPCListeners(): void {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      this.state.pointer = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) {
        this.state.fire = true;
        this.onFireCallback?.();
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this.state.fire = false;
      }
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const keyMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
        '1': 'A', '2': 'B', '3': 'C', '4': 'D',
        'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D',
      };
      if (e.key === ' ') {
        this.state.fire = true;
        this.onFireCallback?.();
        e.preventDefault();
      }
      const select = keyMap[e.key.toLowerCase()];
      if (select) {
        this.state.select = select;
        this.onSelectCallback?.(select);
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === ' ') {
        this.state.fire = false;
      }
    });
  }

  private setupMobileListeners(): void {
    const canvas = this.canvas!;

    canvas.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.state.pointer = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }, { passive: false });

    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.state.pointer = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
      this.state.fire = true;
      this.onFireCallback?.();
    }, { passive: false });

    canvas.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      this.state.fire = false;
    }, { passive: false });
  }

  onFire(cb: () => void): void {
    this.onFireCallback = cb;
  }

  onSelect(cb: (key: 'A' | 'B' | 'C' | 'D') => void): void {
    this.onSelectCallback = cb;
  }

  getCanvasPosition(canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = this.state.isMobile
      ? this.state.pointer.x * scaleX
      : (this.state.pointer.x - rect.left) * scaleX;
    const canvasY = this.state.isMobile
      ? this.state.pointer.y * scaleY
      : (this.state.pointer.y - rect.top) * scaleY;
    return { x: canvasX, y: canvasY };
  }

  destroy(): void {
    this.canvas = null;
    this.onFireCallback = null;
    this.onSelectCallback = null;
  }
}