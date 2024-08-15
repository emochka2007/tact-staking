import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { getJettonAddress } from '../utils/jetton.util';
import { Staking } from '../build/Staking/tact_Staking';

export async function run(provider: NetworkProvider) {
    const stakingAddress = Address.parse(process.env.STAKING_ADDRESS!!);
    const minterAddress = Address.parse(process.env.MINTER_ADDRESS!!);
    const stakingJetton = await getJettonAddress(stakingAddress, minterAddress);
    const staking = provider.open(Staking.fromAddress(stakingAddress));
    await staking.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'SetContractJettonWallet',
            wallet: Address.parse(stakingJetton),
        },
    );
}
