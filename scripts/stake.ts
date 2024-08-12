import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { sendJetton } from '../src/contract-tests/utils';

export async function run(provider: NetworkProvider) {
  const kadys = process.env.KADYS_ADDRESS;
  const minterAddress = process.env.AIOTX_ADDRESS;
  await sendJetton({
    destination: Address.parse(kadys),
    amount: toNano('0.00000001'),
    provider,
    minter: Address.parse(minterAddress),
  });
}
