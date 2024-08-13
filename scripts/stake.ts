import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { sendJetton } from '../tests/utils';
import { getJettonAddress } from '../utils/jetton.util';
import { Kadys } from '../build/Kadys/tact_Kadys';

export async function run(provider: NetworkProvider) {
    const kadysAddress = Address.parse(process.env.KADYS_ADDRESS!!);
    const minterAddress = Address.parse(process.env.MINTER_ADDRESS!!);
    const kadys = provider.open(Kadys.fromAddress(kadysAddress));
    const walletAddress = await kadys.getJettonWallet();
    console.log('=>(stake.ts:12) walletAddress', walletAddress);
    if (walletAddress === null) {
        throw new Error('Setup wallet first');
    }
    await sendJetton({
        destination: kadysAddress,
        amount: toNano('0.00000001'),
        provider,
    });
}
