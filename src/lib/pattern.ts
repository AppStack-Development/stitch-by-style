import type { Pattern, PatternDetails } from '../types';
import { defaultPalette, uid } from './threads';

export function defaultDetails(over: Partial<PatternDetails> = {}): PatternDetails {
  return {
    description: '',
    author: '',
    tags: [],
    difficulty: 'easy',
    estHours: '',
    stitchType: 'cross',
    threadBrand: 'DMC',
    strands: 2,
    needleType: 'เข็มปลายมน (Tapestry)',
    needleSize: '#24',
    baseType: 'print3d',
    aidaCount: 14,
    filament: 'PLA',
    filamentColor: '#f4f1ea',
    thicknessMm: 2,
    holeRatio: 0.55,
    notes: '',
    ...over,
  };
}

export function createPattern(init: {
  name: string;
  mode: Pattern['mode'];
  cols: number;
  rows: number;
  mask: string;
  pitchMm: number;
  templateId?: string;
  templateName?: string;
  details?: Partial<PatternDetails>;
}): Pattern {
  const now = Date.now();
  return {
    id: uid(),
    version: 1,
    name: init.name,
    mode: init.mode,
    templateId: init.templateId,
    templateName: init.templateName,
    cols: init.cols,
    rows: init.rows,
    pitchMm: init.pitchMm,
    mask: init.mask,
    cells: new Array(init.cols * init.rows).fill(-1),
    palette: defaultPalette(),
    details: defaultDetails(init.details),
    createdAt: now,
    updatedAt: now,
  };
}

/** Fill in fields that may be missing in older / imported data. */
export function normalizePattern(raw: any): Pattern {
  const p = raw as Pattern;
  const n = p.cols * p.rows;
  if (!Array.isArray(p.cells) || p.cells.length !== n) throw new Error('ข้อมูลลายไม่ถูกต้อง');
  if (typeof p.mask !== 'string' || p.mask.length !== n) throw new Error('ข้อมูลช่องปักไม่ถูกต้อง');
  return {
    ...p,
    version: 1,
    id: p.id || uid(),
    name: p.name || 'ลายไม่มีชื่อ',
    palette: Array.isArray(p.palette) ? p.palette : [],
    details: defaultDetails(p.details ?? {}),
    createdAt: p.createdAt || Date.now(),
    updatedAt: p.updatedAt || Date.now(),
  };
}

export const STITCH_LABEL: Record<PatternDetails['stitchType'], string> = {
  cross: 'ครอสติช (Cross stitch)',
  half: 'ครึ่งฝีเข็ม (Half stitch)',
  tent: 'เต็นท์สติช (Tent stitch)',
  fill: 'ปักเติมเต็มช่อง (Fill)',
};

export const BASE_LABEL: Record<PatternDetails['baseType'], string> = {
  print3d: 'ชิ้นงานพิมพ์ 3 มิติ',
  aida: 'ผ้า Aida',
  'plastic-canvas': 'แผ่น Plastic canvas',
  other: 'อื่นๆ',
};

export const DIFFICULTY_LABEL: Record<PatternDetails['difficulty'], string> = {
  easy: 'ง่าย',
  medium: 'ปานกลาง',
  hard: 'ยาก',
};
