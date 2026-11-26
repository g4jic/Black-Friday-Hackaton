/** Caps how many model calls run at the same time (free-tier rate limits). FIFO, no starvation. */
export class Semaphore {
  private active = 0
  private peak = 0
  private readonly waiting: Array<() => void> = []

  constructor(private readonly max: number) {
    if (!Number.isInteger(max) || max < 1) throw new Error("Semaphore max must be a positive integer")
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await task()
    } finally {
      this.release()
    }
  }

  get inUse(): number {
    return this.active
  }

  get peakInUse(): number {
    return this.peak
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.take()
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.take()
        resolve()
      })
    })
  }

  private take(): void {
    this.active++
    this.peak = Math.max(this.peak, this.active)
  }

  private release(): void {
    this.active--
    this.waiting.shift()?.()
  }
}
