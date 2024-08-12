import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address } from '@ton/core';
import { fromEarnedToNumber } from '../tests/number';

export async function run(provider: NetworkProvider) {
  const kadysAddress = process.env.KADYS_ADDRESS;
  const hotWalletAddress = process.env.HOT_WALLET_ADDRESS;
  const testAddress = process.env.TEST_ADDRESS;
  const kadys = provider.open(Kadys.fromAddress(Address.parse(kadysAddress)));
  const earned = await kadys.getEarned(Address.parse(testAddress));
  console.log('Earned is', fromEarnedToNumber(earned));
}
