import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address } from '@ton/core';

export async function run(provider: NetworkProvider) {
  // const kadysAddress = process.env.KADYS_ADDRESS;
  // KADYS address
  const kadysAddress = 'kQDo1bR2Q8edNTp2IPBiS1w7v2zTk2AnzkrkKhyGyWxvUx6b';
  const kadys = provider.open(Kadys.fromAddress(Address.parse(kadysAddress)));
  const balance = await kadys.getBalanceOfAddress(provider.sender().address);
  console.log('=>(getBalance.ts:16) balance', balance);
  const balances = await kadys.getBalances();
  console.log('=>(getBalance.ts:11) balances', balances.keys());
}
