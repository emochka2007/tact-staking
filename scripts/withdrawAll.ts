import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { Staking } from '../build/Staking/tact_Staking';
export async function run(provider: NetworkProvider) {
    const stakingAddress = process.env.STAKING_ADDRESS!!;
    const staking = provider.open(Staking.fromAddress(Address.parse(stakingAddress!!)));
    await staking.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'WithdrawAll',
        },
    );
}
