interface LayerBase {
  id: string;
  /** Centro da camada, em px do design. */
  x: number;
  y: number;
  rotation: number;
  scale: number;
  flipX: boolean;
}

export interface ImageLayer extends LayerBase {
  type: 'image';
  src: string;
  width: number;
  height: number;
}

export interface TextLayer extends LayerBase {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  stroke: string | null;
  bold: boolean;
  italic: boolean;
}

export type Layer = ImageLayer | TextLayer;

export interface Design {
  background: string;
  layers: Layer[];
}

export type LayerPatch = Partial<Omit<ImageLayer, 'type' | 'id'>> & Partial<Omit<TextLayer, 'type' | 'id'>>;

export type Panel = 'image' | 'text' | 'background' | 'layers';
