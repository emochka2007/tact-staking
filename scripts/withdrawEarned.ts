import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address, beginCell, toNano } from '@ton/core';
export async function run(provider: NetworkProvider) {
    const kadysAddress = process.env.KADYS_ADDRESS;
    const kadys = provider.open(Kadys.fromAddress(Address.parse(kadysAddress!!)));
    const amount = 100n;
    await kadys.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'WithdrawEarned',
            amount: amount,
        },
    );
}
