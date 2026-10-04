import { mediaPrize, prizeStages } from './content';
import { AppError } from './domain';

export type PrizeSettings = {
  version: number;
  layout: 'podium' | 'ledger';
  stages: { name: string; awards: number[] }[];
  mediaPrize: number;
};
export const defaultPrizes: PrizeSettings = {
  version: 1,
  layout: 'podium',
  stages: prizeStages,
  mediaPrize,
};
export function prizeTotal(settings: PrizeSettings) {
  return settings.stages.reduce(
    (total, stage) => total + stage.awards.reduce((sum, n) => sum + n, 0),
    settings.mediaPrize,
  );
}
export function validatePrizes(body: Record<string, unknown>): PrizeSettings {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new AppError('إعدادات الجوائز غير صالحة.');
  const amount = (n: unknown) =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 10000000;
  if (
    !Number.isSafeInteger(body.version) ||
    !['podium', 'ledger'].includes(String(body.layout)) ||
    !amount(body.mediaPrize) ||
    !Array.isArray(body.stages) ||
    body.stages.length !== prizeStages.length
  )
    throw new AppError('حدد تصميم الجوائز وأدخل مبالغ صحيحة من 0 إلى 10,000,000 ريال.');
  const stages = body.stages.map((stage, i) => {
    if (
      !stage ||
      stage.name !== prizeStages[i].name ||
      !Array.isArray(stage.awards) ||
      stage.awards.length !== 6 ||
      !stage.awards.every(amount)
    )
      throw new AppError('أدخل ست جوائز صحيحة لكل مرحلة تعليمية.');
    return { name: prizeStages[i].name, awards: stage.awards as number[] };
  });
  return {
    version: Number(body.version),
    layout: body.layout as PrizeSettings['layout'],
    stages,
    mediaPrize: body.mediaPrize as number,
  };
}
