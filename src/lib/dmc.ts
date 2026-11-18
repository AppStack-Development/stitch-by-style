/**
 * DMC Mouliné Spécial (6-strand cotton) colour table.
 * RGB values are the approximate screen colours commonly published for each
 * shade; real thread varies by dye lot and screen, so always check a colour card.
 * Format per line: code,r,g,b,name
 */
const RAW = `
B5200,255,255,255,Snow White
White,252,251,248,White
Ecru,240,234,218,Ecru
150,171,2,73,Ultra Very Dark Dusty Rose
151,240,206,212,Very Light Dusty Rose
152,226,160,153,Medium Light Shell Pink
153,230,204,217,Very Light Violet
155,152,145,182,Medium Dark Blue Violet
156,163,174,209,Medium Light Blue Violet
157,187,195,217,Very Light Cornflower Blue
158,76,82,110,Medium Very Dark Cornflower Blue
159,199,202,215,Light Gray Blue
160,153,159,183,Medium Gray Blue
161,120,128,164,Gray Blue
162,219,236,245,Ultra Very Light Blue
163,77,131,97,Medium Celadon Green
164,200,216,184,Light Forest Green
165,239,244,164,Very Light Moss Green
166,192,200,64,Medium Light Moss Green
167,167,124,73,Very Dark Yellow Beige
168,209,209,209,Very Light Pewter
169,132,132,132,Light Pewter
208,131,91,139,Very Dark Lavender
209,163,123,167,Dark Lavender
210,195,159,195,Medium Lavender
211,227,203,227,Light Lavender
221,136,62,67,Very Dark Shell Pink
223,204,132,124,Light Shell Pink
224,235,183,175,Very Light Shell Pink
225,255,223,213,Ultra Very Light Shell Pink
300,111,47,0,Very Dark Mahogany
301,179,95,43,Medium Mahogany
304,183,31,51,Medium Red
307,253,237,84,Lemon
309,186,74,74,Dark Rose
310,0,0,0,Black
311,28,80,102,Medium Navy Blue
312,53,82,102,Very Dark Baby Blue
315,129,73,82,Medium Dark Antique Mauve
316,183,115,127,Medium Antique Mauve
317,108,108,108,Pewter Gray
318,171,171,171,Light Steel Gray
319,32,95,46,Very Dark Pistachio Green
320,105,136,90,Medium Pistachio Green
321,199,43,59,Red
322,90,143,184,Dark Baby Blue
326,179,59,75,Very Dark Rose
327,99,54,102,Dark Violet
333,92,84,120,Very Dark Blue Violet
334,115,159,193,Medium Baby Blue
335,238,84,110,Rose
336,37,59,115,Navy Blue
340,173,167,199,Medium Blue Violet
341,183,191,221,Light Blue Violet
347,191,45,45,Very Dark Salmon
349,210,16,53,Dark Coral
350,224,72,72,Medium Coral
351,233,106,103,Coral
352,253,156,151,Light Coral
353,254,215,204,Peach
355,152,68,54,Dark Terra Cotta
356,197,106,91,Medium Terra Cotta
367,97,122,82,Dark Pistachio Green
368,166,194,152,Light Pistachio Green
369,215,237,204,Very Light Pistachio Green
370,184,157,100,Medium Mustard
371,191,166,113,Mustard
372,204,183,132,Light Mustard
400,143,67,15,Dark Mahogany
402,247,167,119,Very Light Mahogany
407,187,129,97,Dark Desert Sand
413,86,86,86,Dark Pewter Gray
414,140,140,140,Dark Steel Gray
415,211,211,214,Pearl Gray
420,160,112,66,Dark Hazelnut Brown
422,198,159,123,Light Hazelnut Brown
433,122,69,31,Medium Brown
434,152,94,51,Light Brown
435,184,119,72,Very Light Brown
436,203,144,81,Tan
437,228,187,142,Light Tan
444,255,214,0,Dark Lemon
445,255,251,139,Light Lemon
451,145,123,115,Dark Shell Gray
452,192,179,174,Medium Shell Gray
453,215,206,203,Light Shell Gray
469,114,132,60,Avocado Green
470,148,171,79,Light Avocado Green
471,174,191,121,Very Light Avocado Green
472,216,228,152,Ultra Light Avocado Green
498,167,19,43,Dark Red
500,4,77,51,Very Dark Blue Green
501,57,111,82,Dark Blue Green
502,91,144,113,Blue Green
503,123,172,148,Medium Blue Green
504,196,222,204,Very Light Blue Green
517,59,118,143,Dark Wedgwood
518,79,147,167,Light Wedgwood
519,126,177,200,Sky Blue
520,102,109,79,Dark Fern Green
522,150,158,126,Fern Green
523,171,177,151,Light Fern Green
524,196,205,172,Very Light Fern Green
535,99,100,88,Very Light Ash Gray
543,242,227,206,Ultra Very Light Beige Brown
550,92,24,78,Very Dark Violet
552,128,58,107,Medium Violet
553,163,99,139,Violet
554,219,179,203,Light Violet
561,44,106,69,Very Dark Jade
562,83,151,106,Medium Jade
563,143,192,152,Light Jade
564,167,205,175,Very Light Jade
598,144,195,204,Light Turquoise
600,205,47,99,Very Dark Cranberry
601,209,40,106,Dark Cranberry
602,226,72,116,Medium Cranberry
603,255,164,190,Cranberry
604,255,176,190,Light Cranberry
605,255,192,205,Very Light Cranberry
606,250,50,3,Bright Orange-Red
608,253,93,53,Bright Orange
610,121,96,71,Dark Drab Brown
611,150,118,86,Drab Brown
612,188,154,120,Light Drab Brown
613,220,196,170,Very Light Drab Brown
632,135,85,57,Ultra Very Dark Desert Sand
640,133,123,97,Very Dark Beige Gray
642,164,152,120,Dark Beige Gray
644,221,216,203,Medium Beige Gray
645,110,101,92,Very Dark Beaver Gray
646,135,125,115,Dark Beaver Gray
647,176,166,156,Medium Beaver Gray
648,188,180,172,Light Beaver Gray
666,227,29,66,Bright Red
676,229,206,151,Light Old Gold
677,245,236,203,Very Light Old Gold
680,188,141,14,Dark Old Gold
699,5,101,23,Green
700,7,115,27,Bright Green
701,63,143,41,Light Green
702,71,167,47,Kelly Green
703,123,181,71,Chartreuse
704,158,207,52,Bright Chartreuse
712,255,251,239,Cream
718,156,36,98,Plum
720,229,92,31,Dark Orange Spice
721,242,120,66,Medium Orange Spice
722,247,151,111,Light Orange Spice
725,255,200,64,Medium Light Topaz
726,253,215,85,Light Topaz
727,255,241,175,Very Light Topaz
729,208,165,62,Medium Old Gold
730,130,123,48,Very Dark Olive Green
731,147,139,55,Dark Olive Green
732,148,140,54,Olive Green
733,188,179,76,Medium Olive Green
734,199,192,119,Light Olive Green
738,236,204,158,Very Light Tan
739,248,228,200,Ultra Very Light Tan
740,255,131,19,Tangerine
741,255,163,43,Medium Tangerine
742,255,191,87,Light Tangerine
743,254,211,118,Medium Yellow
744,255,231,147,Pale Yellow
745,255,233,173,Light Pale Yellow
746,252,252,238,Off White
747,229,252,253,Very Light Sky Blue
754,247,203,191,Light Peach
758,238,170,155,Very Light Terra Cotta
760,245,173,173,Salmon
761,255,201,201,Light Salmon
762,236,236,236,Very Light Pearl Gray
772,228,236,212,Very Light Yellow Green
775,217,235,241,Very Light Baby Blue
776,252,176,185,Medium Pink
778,223,179,187,Very Light Antique Mauve
779,98,75,69,Dark Cocoa
780,148,99,26,Ultra Very Dark Topaz
781,162,109,32,Very Dark Topaz
782,174,119,32,Dark Topaz
783,206,145,36,Medium Topaz
791,70,69,99,Very Dark Cornflower Blue
792,85,91,123,Dark Cornflower Blue
793,112,125,162,Medium Cornflower Blue
794,143,156,193,Light Cornflower Blue
796,17,65,109,Dark Royal Blue
797,19,71,125,Royal Blue
798,70,106,142,Dark Delft Blue
799,116,142,182,Medium Delft Blue
800,192,204,222,Pale Delft Blue
801,101,57,25,Dark Coffee Brown
803,44,89,124,Ultra Very Dark Baby Blue
806,61,149,165,Dark Peacock Blue
807,100,171,186,Peacock Blue
809,148,168,198,Delft Blue
813,161,194,215,Light Blue
814,123,0,27,Dark Garnet
815,135,7,31,Medium Garnet
816,151,11,35,Garnet
817,187,5,31,Very Dark Coral Red
818,255,223,217,Baby Pink
819,255,238,235,Light Baby Pink
820,14,54,92,Very Dark Royal Blue
822,231,226,211,Light Beige Gray
823,33,48,99,Dark Navy Blue
824,57,105,135,Very Dark Blue
825,71,129,165,Dark Blue
826,107,158,191,Medium Blue
827,189,221,237,Very Light Blue
828,197,232,237,Ultra Very Light Blue
829,126,107,66,Very Dark Golden Olive
830,141,120,75,Dark Golden Olive
831,170,143,86,Medium Golden Olive
832,189,155,81,Golden Olive
833,200,171,108,Light Golden Olive
834,219,190,127,Very Light Golden Olive
838,89,73,55,Very Dark Beige Brown
839,103,85,65,Dark Beige Brown
840,154,124,92,Medium Beige Brown
841,182,155,126,Light Beige Brown
842,209,186,161,Very Light Beige Brown
844,72,72,72,Ultra Dark Beaver Gray
869,131,94,57,Very Dark Hazelnut Brown
890,23,73,35,Ultra Dark Pistachio Green
891,255,87,115,Dark Carnation
892,255,121,140,Medium Carnation
893,252,144,162,Light Carnation
894,255,178,187,Very Light Carnation
895,27,83,0,Very Dark Hunter Green
898,73,42,19,Very Dark Coffee Brown
899,242,118,136,Medium Rose
900,209,88,7,Dark Burnt Orange
902,130,38,55,Very Dark Garnet
904,85,120,34,Very Dark Parrot Green
905,98,138,40,Dark Parrot Green
906,127,179,53,Medium Parrot Green
907,199,230,102,Light Parrot Green
909,21,111,73,Very Dark Emerald Green
910,24,126,86,Dark Emerald Green
911,24,144,101,Medium Emerald Green
912,27,157,107,Light Emerald Green
913,109,171,119,Medium Nile Green
915,130,0,67,Dark Plum
917,155,19,89,Medium Plum
918,130,52,10,Dark Red Copper
919,166,69,16,Red Copper
920,172,84,20,Medium Copper
921,198,98,24,Copper
922,226,115,35,Light Copper
924,86,106,106,Very Dark Gray Green
926,152,174,174,Medium Gray Green
927,189,203,203,Light Gray Green
928,221,227,227,Very Light Gray Green
930,69,92,113,Dark Antique Blue
931,106,133,158,Medium Antique Blue
932,162,181,198,Light Antique Blue
934,49,57,25,Black Avocado Green
935,66,77,33,Dark Avocado Green
936,76,88,38,Very Dark Avocado Green
937,98,113,51,Medium Avocado Green
938,54,31,14,Ultra Dark Coffee Brown
939,27,40,83,Very Dark Navy Blue
943,61,147,132,Medium Aquamarine
945,251,213,187,Tawny
946,235,99,7,Medium Burnt Orange
947,255,123,77,Burnt Orange
948,254,231,218,Very Light Peach
950,238,211,196,Light Desert Sand
951,255,226,207,Light Tawny
954,136,186,145,Nile Green
955,162,214,173,Light Nile Green
956,255,145,145,Geranium
957,253,181,181,Pale Geranium
958,62,182,161,Dark Seagreen
959,89,199,180,Medium Seagreen
961,207,115,115,Dark Dusty Rose
962,230,138,138,Medium Dusty Rose
963,255,215,215,Ultra Very Light Dusty Rose
964,169,226,216,Light Seagreen
966,185,215,192,Medium Baby Green
970,247,139,19,Light Pumpkin
971,246,127,0,Pumpkin
972,255,181,21,Deep Canary
973,255,227,0,Bright Canary
975,145,79,18,Dark Golden Brown
976,194,129,66,Medium Golden Brown
977,220,156,86,Light Golden Brown
986,64,82,48,Very Dark Forest Green
987,88,113,65,Dark Forest Green
988,115,139,91,Medium Forest Green
989,141,166,117,Forest Green
991,71,123,110,Dark Aquamarine
992,111,174,159,Light Aquamarine
993,144,192,180,Very Light Aquamarine
995,38,150,182,Dark Electric Blue
996,48,194,236,Medium Electric Blue
3011,137,138,88,Dark Khaki Green
3012,166,167,93,Medium Khaki Green
3013,185,185,130,Light Khaki Green
3021,79,75,65,Very Dark Brown Gray
3022,142,144,120,Medium Brown Gray
3023,177,170,151,Light Brown Gray
3024,235,234,231,Very Light Brown Gray
3031,75,60,42,Very Dark Mocha Brown
3032,179,159,139,Medium Mocha Brown
3033,227,216,204,Very Light Mocha Brown
3045,188,150,106,Dark Yellow Beige
3046,216,188,154,Medium Yellow Beige
3047,231,214,193,Light Yellow Beige
3064,196,142,112,Desert Sand
3078,253,249,205,Very Light Golden Yellow
3325,184,210,230,Light Baby Blue
3326,251,173,180,Light Rose
3328,227,109,109,Dark Salmon
3340,255,131,111,Medium Apricot
3341,252,171,152,Apricot
3345,27,89,21,Dark Hunter Green
3346,64,106,58,Hunter Green
3347,113,147,78,Medium Yellow Green
3348,204,217,177,Light Yellow Green
3350,188,67,101,Ultra Dark Dusty Rose
3354,228,166,172,Light Dusty Rose
3362,94,107,71,Dark Pine Green
3363,114,130,86,Medium Pine Green
3364,131,151,95,Pine Green
3371,30,17,8,Black Brown
3607,197,73,137,Light Plum
3608,234,156,196,Very Light Plum
3609,244,174,213,Ultra Light Plum
3685,136,21,49,Very Dark Mauve
3687,201,107,112,Mauve
3688,231,169,172,Medium Mauve
3689,251,191,194,Light Mauve
3705,255,121,146,Dark Melon
3706,255,173,188,Medium Melon
3708,255,203,213,Light Melon
3712,241,135,135,Medium Salmon
3713,255,226,226,Very Light Salmon
3716,255,189,189,Very Light Dusty Rose
3721,161,75,81,Dark Shell Pink
3722,188,108,100,Medium Shell Pink
3726,155,91,102,Dark Antique Mauve
3727,219,169,178,Light Antique Mauve
3731,218,103,131,Very Dark Dusty Rose
3733,232,135,155,Dusty Rose
3740,120,88,101,Dark Antique Violet
3743,215,203,211,Very Light Antique Violet
3746,119,107,152,Dark Blue Violet
3747,211,215,237,Very Light Blue Violet
3750,56,76,94,Very Dark Antique Blue
3752,199,209,219,Very Light Antique Blue
3753,219,226,233,Ultra Very Light Antique Blue
3755,147,180,206,Baby Blue
3756,238,252,252,Ultra Very Light Baby Blue
3760,62,133,162,Medium Wedgwood
3761,172,216,226,Light Sky Blue
3765,52,127,140,Very Dark Peacock Blue
3766,153,207,217,Light Peacock Blue
3768,101,127,127,Dark Gray Green
3770,255,238,227,Very Light Tawny
3772,160,108,80,Very Dark Desert Sand
3774,243,225,215,Very Light Desert Sand
3776,207,121,57,Light Mahogany
3777,134,48,34,Very Dark Terra Cotta
3778,217,137,120,Light Terra Cotta
3779,248,202,200,Ultra Very Light Terra Cotta
3781,107,87,67,Dark Mocha Brown
3787,98,93,80,Dark Brown Gray
3790,127,106,85,Ultra Dark Beige Gray
3799,66,66,66,Very Dark Pewter Gray
3801,231,73,103,Very Dark Melon
3802,113,65,73,Very Dark Antique Mauve
3803,171,51,87,Dark Mauve
3804,224,40,118,Dark Cyclamen Pink
3805,243,71,139,Cyclamen Pink
3806,255,140,174,Light Cyclamen Pink
3807,96,103,140,Cornflower Blue
3808,54,105,112,Ultra Very Dark Turquoise
3809,63,124,133,Very Dark Turquoise
3810,72,142,154,Dark Turquoise
3811,188,227,230,Very Light Turquoise
3812,47,140,132,Very Dark Seagreen
3813,178,212,189,Light Blue Green
3814,80,139,125,Aquamarine
3815,71,119,89,Dark Celadon Green
3816,101,165,125,Celadon Green
3817,153,195,170,Light Celadon Green
3818,17,90,59,Ultra Very Dark Emerald Green
3819,224,232,104,Light Moss Green
3820,223,182,95,Dark Straw
3821,243,206,117,Straw
3822,246,220,152,Light Straw
3823,255,253,227,Ultra Pale Yellow
3824,254,205,194,Light Apricot
3825,253,189,150,Pale Pumpkin
3826,173,114,57,Golden Brown
3827,247,187,119,Pale Golden Brown
3828,183,139,97,Hazelnut Brown
3829,169,130,4,Very Dark Old Gold
3830,185,85,68,Terra Cotta
3831,179,47,72,Dark Raspberry
3832,219,85,110,Medium Raspberry
3833,234,134,153,Light Raspberry
3834,114,55,93,Dark Grape
3835,148,96,131,Medium Grape
3836,186,145,170,Light Grape
3837,108,58,110,Ultra Dark Lavender
3838,92,114,148,Dark Lavender Blue
3839,123,142,171,Medium Lavender Blue
3840,176,192,218,Light Lavender Blue
3841,205,223,237,Pale Baby Blue
3842,50,102,124,Dark Wedgwood
3843,20,170,208,Electric Blue
3844,18,174,186,Dark Bright Turquoise
3845,4,196,202,Medium Bright Turquoise
3846,6,227,230,Light Bright Turquoise
3847,52,125,117,Dark Teal Green
3848,85,147,146,Medium Teal Green
3849,82,179,164,Light Teal Green
3850,55,132,119,Dark Bright Green
3851,73,179,161,Light Bright Green
3852,205,157,55,Very Dark Straw
3853,242,151,70,Dark Autumn Gold
3854,242,175,104,Medium Autumn Gold
3855,250,211,150,Light Autumn Gold
3856,255,211,181,Ultra Very Light Mahogany
3857,104,37,26,Dark Rosewood
3858,150,74,63,Medium Rosewood
3859,186,139,124,Light Rosewood
3860,125,93,87,Cocoa
3861,166,136,129,Light Cocoa
3862,138,110,78,Dark Mocha Beige
3863,164,131,92,Medium Mocha Beige
3864,203,182,156,Light Mocha Beige
3865,249,247,241,Winter White
3866,250,246,240,Ultra Very Light Mocha Brown
`;

export interface DmcColor {
  code: string;
  name: string;
  hex: string;
}

const hex2 = (v: number) => v.toString(16).padStart(2, '0');

export const DMC_LIBRARY: DmcColor[] = RAW.trim()
  .split('\n')
  .map((line) => {
    const [code, r, g, b, ...name] = line.split(',');
    return { code, name: name.join(','), hex: '#' + hex2(+r) + hex2(+g) + hex2(+b) };
  });

/** Hue/lightness key so the library browses like a colour wheel, neutrals last. */
export function colorSortKey(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  // neutrals (low saturation) go into their own group at the end, dark to light
  if (s < 0.12) return [1, 0, -l];
  // 12 hue buckets so similar hues stay together, light to dark inside each
  return [0, Math.floor(((h * 60 + 15) % 360) / 30), -l];
}

export const DMC_SORTED: DmcColor[] = [...DMC_LIBRARY].sort((a, b) => {
  const ka = colorSortKey(a.hex), kb = colorSortKey(b.hex);
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
});
