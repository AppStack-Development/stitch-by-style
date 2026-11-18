/**
 * Cell kinds in a pattern mask:
 *  '0' = empty (outside the piece / cut-out such as a keyring hole)
 *  '1' = solid frame (plastic, not stitchable)
 *  '2' = stitchable hole / fabric cell
 */
export type CellKind = '0' | '1' | '2';

export interface ThreadColor {
  id: string;
  hex: string;
  name: string;
  brand: string;
  code: string;
  symbol: string;
}

export type StitchType = 'cross' | 'half' | 'tent' | 'fill';
export type BaseType = 'print3d' | 'aida' | 'plastic-canvas' | 'other';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface PatternDetails {
  description: string;
  author: string;
  tags: string[];
  difficulty: Difficulty;
  estHours: string;
  stitchType: StitchType;
  threadBrand: string;
  strands: number;
  needleType: string;
  needleSize: string;
  baseType: BaseType;
  aidaCount: number;
  filament: string;
  filamentColor: string;
  thicknessMm: number;
  holeRatio: number;
  notes: string;
}

export interface Pattern {
  id: string;
  version: 1;
  name: string;
  mode: 'free' | 'template';
  templateId?: string;
  templateName?: string;
  cols: number;
  rows: number;
  /** distance between hole/cell centres in mm */
  pitchMm: number;
  /** one CellKind char per cell, row-major */
  mask: string;
  /** palette index per cell, -1 = empty */
  cells: number[];
  palette: ThreadColor[];
  details: PatternDetails;
  createdAt: number;
  updatedAt: number;
}

export type Tool = 'pencil' | 'eraser' | 'fill' | 'picker' | 'line' | 'rect' | 'hole' | 'pan';
export type HoleBrush = '2' | '1' | '0';
export type ViewMode = 'stitch' | 'color' | 'symbol';
