import type { BenchmarkRun } from './types'

const runs = new Map<string, BenchmarkRun>()
export function saveBenchmark(run: BenchmarkRun): void { runs.set(run.id, run) }
export function getBenchmark(id: string): BenchmarkRun | undefined { return runs.get(id) }
