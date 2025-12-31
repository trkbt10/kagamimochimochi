import { describe, test, expect } from 'bun:test'
import { drawRoundRect } from './canvas-helpers'

/**
 * Canvas2Dコンテキストのフェイク
 */
function createFakeContext(): {
  context: CanvasRenderingContext2D
  calls: { method: string; args: unknown[] }[]
} {
  const calls: { method: string; args: unknown[] }[] = []

  const context = {
    beginPath: () => calls.push({ method: 'beginPath', args: [] }),
    moveTo: (x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] }),
    lineTo: (x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] }),
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) =>
      calls.push({ method: 'quadraticCurveTo', args: [cpx, cpy, x, y] }),
    closePath: () => calls.push({ method: 'closePath', args: [] })
  } as unknown as CanvasRenderingContext2D

  return { context, calls }
}

describe('drawRoundRect', () => {
  test('角丸矩形のパスが正しく作成される', () => {
    const { context, calls } = createFakeContext()

    drawRoundRect(context, 10, 20, 100, 50, 5)

    expect(calls[0]).toEqual({ method: 'beginPath', args: [] })
    expect(calls[1]).toEqual({ method: 'moveTo', args: [15, 20] })
    expect(calls[calls.length - 1]).toEqual({ method: 'closePath', args: [] })
  })

  test('4つの角に quadraticCurveTo が呼ばれる', () => {
    const { context, calls } = createFakeContext()

    drawRoundRect(context, 0, 0, 100, 50, 10)

    const quadraticCalls = calls.filter((c) => c.method === 'quadraticCurveTo')
    expect(quadraticCalls.length).toBe(4)
  })

  test('lineTo が4辺に対して呼ばれる', () => {
    const { context, calls } = createFakeContext()

    drawRoundRect(context, 0, 0, 100, 50, 10)

    const lineToCalls = calls.filter((c) => c.method === 'lineTo')
    expect(lineToCalls.length).toBe(4)
  })

  test('radius=0 でも正しく動作する', () => {
    const { context, calls } = createFakeContext()

    drawRoundRect(context, 0, 0, 100, 50, 0)

    expect(calls[0].method).toBe('beginPath')
    expect(calls[calls.length - 1].method).toBe('closePath')
  })
})
