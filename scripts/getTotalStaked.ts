import { NetworkProvider } from '@ton/blueprint';
import { Staking } from '../build/Staking/tact_Staking';
import { Address } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const stakingAddress = process.env.STAKING_ADDRESS!!;
    const staking = provider.open(Staking.fromAddress(Address.parse(stakingAddress)));
    const balance = await staking.getBalances();
    let totalSum = balance
        .values()
        .map((v) => v.totalDeposit)
        .reduce((acc, sum) => acc + sum, 0n);
    console.log(totalSum);
}
