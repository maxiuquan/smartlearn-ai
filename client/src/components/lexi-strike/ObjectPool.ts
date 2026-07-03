export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 20) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      const obj = this.factory();
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  get size(): number {
    return this.pool.length;
  }

  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      const obj = this.factory();
      this.reset(obj);
      this.pool.push(obj);
    }
  }
}