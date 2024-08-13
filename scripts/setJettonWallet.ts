import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address, toNano } from '@ton/core';
import { getJettonAddress } from '../utils/jetton.util';

export async function run(provider: NetworkProvider) {
    const kadysAddress = Address.parse(process.env.KADYS_ADDRESS!!);
    const minterAddress = Address.parse(process.env.MINTER_ADDRESS!!);
    const kadysJetton = await getJettonAddress(kadysAddress, minterAddress);
    const kadys = provider.open(Kadys.fromAddress(kadysAddress));
    await kadys.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'SetContractJettonWallet',
            wallet: Address.parse(kadysJetton),
        },
    );
}
