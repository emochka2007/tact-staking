import { SCALE_FACTOR } from './utils';

export const fromEarnedToNumber = (earned: bigint) => {
  return Number(earned) / Number(SCALE_FACTOR);
};
