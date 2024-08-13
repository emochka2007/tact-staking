import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address, fromNano } from '@ton/core';

export async function run(provider: NetworkProvider) {
    const kadysAddress = process.env.KADYS_ADDRESS!!;
    const kadys = provider.open(Kadys.fromAddress(Address.parse(kadysAddress)));
    // might return zero if less than toNano(1)
    const earned = await kadys.getEarnedOfAddress(provider.sender().address!!);
    console.log('=>(earned.ts:10) earned', fromNano(earned));
    console.log('=>(earned.ts:10) earned', earned);
}
