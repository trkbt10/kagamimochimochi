// Layout module exports
export {
  SAFE_AREA_ASPECT,
  calculateSafeArea,
  type SafeAreaBounds,
  type WorldBounds,
} from './SafeAreaCalculator'

export {
  LayoutManager,
  type LayoutMode,
  type LayoutInfo,
  type DecorationArea,
  type LayoutChangeListener,
} from './LayoutManager'

export { CoordinateConverter } from './CoordinateConverter'

export {
  extendParticlesToDecoration,
  redistributeParticles,
  clampToSafeArea,
  positionInSafeArea,
  adjustScaleForLayout,
  calculateLayoutScale,
} from './DecorationHelper'
