import { NetworkProvider } from '@ton/blueprint';
import { Staking } from '../build/Staking/tact_Staking';
import { Address } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const stakingAddress = process.env.STAKING_ADDRESS!!;
    const staking = provider.open(Staking.fromAddress(Address.parse(stakingAddress)));
    const balance = await staking.getYearlyPercent();
    console.log("=>(getYearlyPercent.ts:10) balance", balance);
}
