export type ExtrudeTextOptions = {
  depth: number
  bevelThickness: number
  bevelSize: number
  bevelSegments: number
  frontColor: number
  sideColor: number
}

export type TextConfig = {
  font: {
    family: string
    weight: string
    path: string
  }
  texts: string[]
}
