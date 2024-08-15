import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { sendJetton } from '../tests/utils';
import { Staking } from '../build/Staking/tact_Staking';

export async function run(provider: NetworkProvider) {
    const stakingAddress = Address.parse(process.env.STAKING_ADDRESS!!);
    const staking = provider.open(Staking.fromAddress(stakingAddress));
    const walletAddress = await staking.getJettonWallet();
    if (walletAddress === null) {
        throw new Error('Setup wallet first');
    }
    await sendJetton({
        destination: stakingAddress,
        amount: toNano('0.1'),
        provider,
    });
}
