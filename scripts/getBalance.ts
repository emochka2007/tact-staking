import { NetworkProvider } from '@ton/blueprint';
import { Address } from '@ton/core';
import { Staking } from '../build/Staking/tact_Staking';

export async function run(provider: NetworkProvider) {
    const stakingAddress = process.env.STAKING_ADDRESS!!;
    const staking = provider.open(Staking.fromAddress(Address.parse(stakingAddress)));
    const balance = await staking.getBalanceOfAddress(provider.sender().address!!);
    console.log('=>(getBalance.ts:16) balance', balance);
    const balances = await staking.getBalances();
    console.log('=>(getBalance.ts:11) balances', balances.keys());
}
