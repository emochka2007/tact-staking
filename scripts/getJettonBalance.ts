import { NetworkProvider } from '@ton/blueprint';
import { Address, toNano } from '@ton/core';
import { Staking } from '../build/Staking/tact_Staking';
import { getJettonAddress, getJettonData } from '../utils/jetton.util';

export async function run(provider: NetworkProvider) {
    const stakingAddress = process.env.STAKING_ADDRESS!!;
    const staking = provider.open(Staking.fromAddress(Address.parse(stakingAddress!!)));
    const jettonMaster = Address.parse(process.env.JETTON_MASTER!!);
    const stakingJetton = await getJettonAddress(staking.address!!, jettonMaster);
    const deployerJetton = await getJettonData(Address.parse(stakingJetton));
    //Get balance of jetton
    console.log('=>(withdrawJettonFromContractByOwner.ts:13) deployerJetton', deployerJetton.balance.toString());
}
