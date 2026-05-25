// Coefficient matrix for daily macro targets
export const COEFFICIENTS: Record<string, Record<string, { carbs: number; protein: number; fat: number }>> = {
  male: {
    '2-3': { carbs: 2.2, protein: 1.4, fat: 0.8 },
    '4-5': { carbs: 2.5, protein: 1.6, fat: 0.9 },
    '6-7': { carbs: 3.0, protein: 1.7, fat: 1.0 },
    '8-9': { carbs: 3.5, protein: 1.8, fat: 1.0 },
  },
  female: {
    '2-3': { carbs: 2.0, protein: 1.4, fat: 1.0 },
    '4-5': { carbs: 2.2, protein: 1.6, fat: 1.1 },
    '6-7': { carbs: 2.5, protein: 1.7, fat: 1.1 },
    '8-9': { carbs: 3.0, protein: 1.8, fat: 1.2 },
  },
};

export function calcDailyTargets(
  gender: string,
  workoutLevel: string,
  weight: number,
  carbModifier = 1.0
): { carbs: number; protein: number; fat: number; calories: number } {
  const c = COEFFICIENTS[gender]?.[workoutLevel] ?? COEFFICIENTS[gender]['2-3'];
  const carbs = Math.round(weight * c.carbs * carbModifier);
  const protein = Math.round(weight * c.protein);
  const fat = Math.round(weight * c.fat);
  const calories = Math.round(carbs * 4 + protein * 4 + fat * 9);
  return { carbs, protein, fat, calories };
}

export function getDayOfCycle(dayIndex: number): number {
  return Math.floor(dayIndex / 10) + 1;
}

export function getDaysLeftInCycle(dayIndex: number): number {
  return 9 - (dayIndex % 10);
}

export function getCycleNumber(dayIndex: number): number {
  return Math.floor(dayIndex / 10) + 1;
}