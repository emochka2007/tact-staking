import { NetworkProvider } from '@ton/blueprint';
import { Staking } from '../build/Staking/tact_Staking';
import { Address, toNano } from '@ton/core';
import { getJettonAddress } from '../utils/jetton.util';

export async function run(provider: NetworkProvider) {
    const stakingAddress = process.env.STAKING_ADDRESS!!;
    const staking = provider.open(Staking.fromAddress(Address.parse(stakingAddress!!)));
    const amount = toNano('0.0001');
    const jettonMaster = Address.parse(process.env.JETTON_MASTER!!);
    const stakingJetton = await getJettonAddress(provider.sender().address!!, jettonMaster);
    await staking.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'WithdrawJetton',
            amount: amount,
            //Can be any wallet address (not jetton address)
            to: Address.parse(stakingJetton),
        },
    );
}
