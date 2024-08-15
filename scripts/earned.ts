import { NetworkProvider } from '@ton/blueprint';
import { Address, fromNano } from '@ton/core';
import { Staking } from '../build/Staking/tact_Staking';

export async function run(provider: NetworkProvider) {
    const stakingAddress = process.env.STAKING_ADDRESS!!;
    const staking = provider.open(Staking.fromAddress(Address.parse(stakingAddress)));
    // might return zero if less than toNano(1)
    const earned = await staking.getEarnedOfAddress(provider.sender().address!!);
    console.log('=>(earned.ts:10) earned', fromNano(earned));
    console.log('=>(earned.ts:10) earned', earned);
}
