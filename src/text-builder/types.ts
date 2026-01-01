/** アウトラインレイヤーの定義 */
export type OutlineLayer = {
  /** ベベル拡大量（メインのbevelSizeに加算される値） */
  bevelOffset: number
  /** 色 */
  color: number
}

export type ExtrudeTextOptions = {
  depth: number
  bevelThickness: number
  bevelSize: number
  bevelSegments: number
  frontColor: number
  sideColor: number
  /** アウトラインレイヤー（外側から順） */
  outlines?: OutlineLayer[]
}

/** テキストごとの設定 */
export type TextEntry = {
  text: string
  /** 原点オフセット（0-1、0.5が中央）。未指定時は自動計算 */
  originX?: number
}

export type TextConfig = {
  font: {
    family: string
    weight: string
    path: string
  }
  /** テキスト一覧（文字列または詳細設定オブジェクト） */
  texts: Array<string | TextEntry>
}

/** 生成されたテキストデータ */
export type TextPathData = {
  svg: string
  /** 視覚的重心のX位置（SVG座標系） */
  originX: number
  /** 視覚的重心のY位置（SVG座標系） */
  originY: number
}
