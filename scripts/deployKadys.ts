import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { JettonDefaultWallet } from '../build/Jetton/tact_JettonDefaultWallet';
import { updateEnvFile } from '../updateEnv';

export async function run(provider: NetworkProvider) {
    const kadys = provider.open(await Kadys.fromInit());
    const minterAddress = process.env.AIOTX_ADDRESS!!;
    await kadys.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );

    await provider.waitForDeploy(kadys.address);
    updateEnvFile('KADYS_ADDRESS', kadys.address.toString({ urlSafe: true }));
}
