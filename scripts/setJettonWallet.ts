import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address, toNano } from '@ton/core';

export async function run(provider: NetworkProvider) {
  const kadysAddress = process.env.KADYS_ADDRESS;
  // const kadysJetton = process.env.KADYS_JETTON;
  const kadysJetton = 'kQBSo8fMn0ApEd-aVyQZCzeoeiR2YlSS0V0EHlrNnW7rHNYj';
  const kadys = provider.open(Kadys.fromAddress(Address.parse(kadysAddress)));
  const jettonWallet = await kadys.getJettonWallet();
  console.log('=>(setJettonWallet.ts:10) jettonWallet.toString', jettonWallet);
  return;
  await kadys.send(
    provider.sender(),
    {
      value: toNano('0.05'),
    },
    {
      $$type: 'SetContractJettonWallet',
      wallet: Address.parse(kadysJetton),
    },
  );
}
