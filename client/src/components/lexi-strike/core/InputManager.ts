export interface InputState {
  pointer: { x: number; y: number };
  fire: boolean;
  select: 'A' | 'B' | 'C' | null;
}

export class InputManager {
  public state: InputState = {
    pointer: { x: 0, y: 0 },
    fire: false,
    select: null,
  };

  private canvas: HTMLCanvasElement | null = null;
  private onFireCallback: (() => void) | null = null;
  private onSelectCallback: ((key: 'A' | 'B' | 'C') => void) | null = null;
  public isMobile = false;

  setup(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (this.isMobile) {
      this.setupMobileListeners();
    } else {
      this.setupPCListeners();
    }
  }

  setMobileInput(type: 'select', value: 'A' | 'B' | 'C'): void {
    if (!this.isMobile) return;
    this.state.select = value;
    this.state.fire = true;
    this.onSelectCallback?.(value);
    this.onFireCallback?.();
  }

  clearMobileInput(): void {
    this.state.fire = false;
    this.state.select = null;
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

    window.addEventListener('mouseup', () => {
      this.state.fire = false;
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        this.state.fire = true;
        this.onFireCallback?.();
        e.preventDefault();
        return;
      }
      const keyMap: Record<string, 'A' | 'B' | 'C'> = { '1': 'A', '2': 'B', '3': 'C' };
      const select = keyMap[e.key];
      if (select) {
        this.state.select = select;
        this.onSelectCallback?.(select);
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
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
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height),
      };
    }, { passive: false });

    canvas.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      this.state.pointer = {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height),
      };
    }, { passive: false });
  }

  onFire(cb: () => void): void { this.onFireCallback = cb; }
  onSelect(cb: (key: 'A' | 'B' | 'C') => void): void { this.onSelectCallback = cb; }

  destroy(): void {
    this.canvas = null;
    this.onFireCallback = null;
    this.onSelectCallback = null;
  }
}