'use client';
import { useId } from 'react';
import { groupParticipants, type AnalyticsParticipant } from '@/lib/analytics';
import { cityCenters, cityProjection, geographicPath } from '@/lib/city-geography';
import boundaries from '@/lib/data/eastern-region-map.json';

const paths = boundaries.features.map((feature) => ({
  ...feature.properties,
  path: geographicPath(
    feature.geometry.coordinates as number[][][] | number[][][][],
    feature.geometry.type === 'MultiPolygon',
  ),
}));

export function CityParticipationMap({
  people,
  selectedCity,
  onSelect,
}: {
  people: AnalyticsParticipant[];
  selectedCity: string;
  onSelect: (city: string) => void;
}) {
  const id = useId().replace(/:/g, '');
  const groups = groupParticipants(people, 'locality');
  const counts = new Map(groups.map((group) => [group.label, group.total]));
  const maximum = Math.max(
    0,
    ...groups
      .filter((group) => cityCenters.some((city) => city.name === group.label))
      .map((group) => group.total),
  );
  const unmapped = groups.filter((group) => !cityCenters.some((city) => city.name === group.label));
  return (
    <>
      <div className="analytics-city-map-layout">
        <svg
          className="analytics-city-map"
          viewBox="0 0 560 470"
          role="img"
          aria-label="خريطة مسجلي المسابقة عند مراكز مدن المنطقة الشرقية"
        >
          <title>
            مشاركة مدن المنطقة الشرقية. شدة اللون تتناسب مع عدد المسجلين في المجموعة المختارة.
          </title>
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect x="0" y="0" width="560" height="470" />
            </clipPath>
            {cityCenters.map((city, index) => (
              <radialGradient key={city.name} id={`${id}-heat-${index}`}>
                <stop offset="0" stopColor="var(--olive)" stopOpacity=".9" />
                <stop offset="1" stopColor="var(--olive)" stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          <rect className="analytics-map-water" width="560" height="470" />
          <g clipPath={`url(#${id}-clip)`}>
            {paths.map((region) => (
              <path
                key={region.iso}
                d={region.path}
                className={`analytics-map-land ${region.iso === 'SA-04' ? 'eastern' : ''}`}
                fillRule="evenodd"
              >
                <title>{region.name}</title>
              </path>
            ))}
            <text x="250" y="220" className="analytics-map-region" textAnchor="middle">
              المنطقة الشرقية
            </text>
            <text x="500" y="350" className="analytics-map-region" textAnchor="middle">
              الخليج العربي
            </text>
            {cityCenters.map((city, index) => {
              const [x, y] = cityProjection(city.longitude, city.latitude),
                count = counts.get(city.name) ?? 0;
              return (
                <g key={city.name}>
                  <title>{`${city.name}: ${count.toLocaleString('ar-SA')} مسجل`}</title>
                  {count > 0 && (
                    <circle
                      cx={x}
                      cy={y}
                      r="28"
                      fill={`url(#${id}-heat-${index})`}
                      opacity={maximum ? 0.3 + (0.7 * count) / maximum : 0}
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={city.name === selectedCity ? 5 : 3}
                    className={`analytics-map-center ${count ? 'has-participants' : ''}`}
                  />
                  {city.name === selectedCity && (
                    <text x={x - 9} y={y - 10} textAnchor="end" className="analytics-map-region">
                      {city.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="analytics-map-cities" aria-label="اختيار مدينة من الخريطة">
          {cityCenters.map((city) => (
            <button
              key={city.name}
              className="analytics-city-choice"
              type="button"
              aria-pressed={selectedCity === city.name}
              onClick={() => onSelect(selectedCity === city.name ? '' : city.name)}
            >
              <span>{city.name}</span>
              <bdi>{(counts.get(city.name) ?? 0).toLocaleString('ar-SA')}</bdi>
            </button>
          ))}
        </div>
      </div>
      <div className="analytics-map-scale">
        <span>0</span>
        <span className="analytics-heat-scale" />
        <span>{maximum.toLocaleString('ar-SA')} مسجل · الحد الأعلى في العرض</span>
      </div>
      {unmapped.length > 0 && (
        <p className="fine-print">
          مدن بلا موقع موثّق على هذه الخريطة، مع بقائها في الإجماليات:{' '}
          {unmapped.map((group) => `${group.label} (${group.total})`).join('، ')}.
        </p>
      )}
      <p className="fine-print">
        المواقع تمثل مراكز المدن / المحافظات تقريبًا، وليست عناوين المشاركين أو كثافة السكان. اختر
        مدينة من القائمة لتصفية جميع الرسوم.
      </p>
      <details className="analytics-map-sources">
        <summary>مصادر الخريطة</summary>
        <p>
          الحدود:{' '}
          <a
            href="https://www.geoboundaries.org/api/current/gbOpen/SAU/ADM1/"
            target="_blank"
            rel="noreferrer"
          >
            geoBoundaries
          </a>{' '}
          /{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap contributors
          </a>{' '}
          ·{' '}
          <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">
            ODbL 1.0
          </a>
          . مراكز المدن:{' '}
          <a
            href="https://download.geonames.org/export/dump/readme.txt"
            target="_blank"
            rel="noreferrer"
          >
            GeoNames · CC BY 4.0
          </a>
          . البيضاء:{' '}
          <a
            href="https://www.sharqiah.gov.sa/governorates/al-baidhah"
            target="_blank"
            rel="noreferrer"
          >
            إمارة المنطقة الشرقية
          </a>
          . الأحساء ممثلة عند الهفوف.
        </p>
      </details>
    </>
  );
}
