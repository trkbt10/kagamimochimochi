import { describe, it, expect } from 'bun:test'
import { getScoreTier, getScoreTierConfig } from './ResultScene'

describe('getScoreTier', () => {
  it('returns perfect for score 100', () => {
    expect(getScoreTier(100)).toBe('perfect')
  })

  it('returns perfect for score above 100', () => {
    expect(getScoreTier(120)).toBe('perfect')
  })

  it('returns excellent for score 80-99', () => {
    expect(getScoreTier(80)).toBe('excellent')
    expect(getScoreTier(99)).toBe('excellent')
  })

  it('returns good for score 60-79', () => {
    expect(getScoreTier(60)).toBe('good')
    expect(getScoreTier(79)).toBe('good')
  })

  it('returns average for score 40-59', () => {
    expect(getScoreTier(40)).toBe('average')
    expect(getScoreTier(59)).toBe('average')
  })

  it('returns poor for score 20-39', () => {
    expect(getScoreTier(20)).toBe('poor')
    expect(getScoreTier(39)).toBe('poor')
  })

  it('returns fail for score below 20', () => {
    expect(getScoreTier(0)).toBe('fail')
    expect(getScoreTier(19)).toBe('fail')
  })

  it('returns fail for negative scores', () => {
    expect(getScoreTier(-10)).toBe('fail')
  })
})

describe('getScoreTierConfig', () => {
  it('returns config with correct emoji for perfect tier', () => {
    const config = getScoreTierConfig(100)
    expect(config.emoji).toContain('🏆')
    expect(config.isSuccess).toBe(true)
  })

  it('returns config with correct emoji for excellent tier', () => {
    const config = getScoreTierConfig(85)
    expect(config.emoji).toContain('🎉')
    expect(config.isSuccess).toBe(true)
  })

  it('returns config with isSuccess false for good tier', () => {
    const config = getScoreTierConfig(70)
    expect(config.isSuccess).toBe(false)
  })

  it('returns config with isSuccess false for fail tier', () => {
    const config = getScoreTierConfig(10)
    expect(config.isSuccess).toBe(false)
    expect(config.emoji).toContain('💀')
  })

  it('returns config with valid bgColor for all tiers', () => {
    const scores = [100, 85, 70, 50, 30, 10]
    scores.forEach(score => {
      const config = getScoreTierConfig(score)
      expect(typeof config.bgColor).toBe('number')
      expect(config.bgColor).toBeGreaterThan(0)
    })
  })

  it('returns config with valid accentLightColor for all tiers', () => {
    const scores = [100, 85, 70, 50, 30, 10]
    scores.forEach(score => {
      const config = getScoreTierConfig(score)
      expect(typeof config.accentLightColor).toBe('number')
      expect(config.accentLightColor).toBeGreaterThan(0)
    })
  })

  it('returns config with valid particleColor for all tiers', () => {
    const scores = [100, 85, 70, 50, 30, 10]
    scores.forEach(score => {
      const config = getScoreTierConfig(score)
      expect(config.particleColor.x).toBeGreaterThanOrEqual(0)
      expect(config.particleColor.x).toBeLessThanOrEqual(1)
      expect(config.particleColor.y).toBeGreaterThanOrEqual(0)
      expect(config.particleColor.y).toBeLessThanOrEqual(1)
      expect(config.particleColor.z).toBeGreaterThanOrEqual(0)
      expect(config.particleColor.z).toBeLessThanOrEqual(1)
    })
  })

  it('returns config with text in Japanese', () => {
    const config = getScoreTierConfig(85)
    expect(config.text).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/)
  })
})
