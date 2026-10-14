export const cityCenters = [
  { name: 'الدمام', latitude: 26.43442, longitude: 50.10326, geonamesId: 110336 },
  { name: 'الأحساء', latitude: 25.36467, longitude: 49.58764, geonamesId: 109571 },
  { name: 'الجبيل', latitude: 27.0174, longitude: 49.62251, geonamesId: 109435 },
  { name: 'القطيف', latitude: 26.56542, longitude: 50.0089, geonamesId: 108927 },
  { name: 'الخبر', latitude: 26.27944, longitude: 50.20833, geonamesId: 109323 },
  { name: 'الخفجي', latitude: 28.43905, longitude: 48.49132, geonamesId: 109380 },
  { name: 'رأس تنورة', latitude: 26.70742, longitude: 50.06735, geonamesId: 102891 },
  { name: 'بقيق', latitude: 25.93402, longitude: 49.6688, geonamesId: 107312 },
  { name: 'النعيرية', latitude: 27.47324, longitude: 48.47479, geonamesId: 108610 },
  { name: 'قرية العليا', latitude: 27.55857, longitude: 47.70409, geonamesId: 103283 },
  { name: 'حفر الباطن', latitude: 28.43279, longitude: 45.97077, geonamesId: 106297 },
  { name: 'البيضاء', latitude: 26.361361, longitude: 49.969639, geonamesId: null },
] as const;

// Equirectangular projection centered on the registered cities, with longitude scaled at 27°N.
export function cityProjection(longitude: number, latitude: number) {
  const x = (longitude - 45.5) * Math.cos((27 * Math.PI) / 180);
  const y = 29 - latitude;
  return [28 + x * 114, 24 + y * 114] as const;
}

export function geographicPath(coordinates: number[][][] | number[][][][], multi: boolean) {
  const polygons = multi ? (coordinates as number[][][][]) : [coordinates as number[][][]];
  return polygons
    .flatMap((polygon) =>
      polygon.map(
        (ring) =>
          ring
            .map((point, i) => {
              const [x, y] = cityProjection(point[0], point[1]);
              return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join('') + 'Z',
      ),
    )
    .join('');
}
