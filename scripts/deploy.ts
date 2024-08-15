import { toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { updateEnvFile } from '../updateEnv';
import { Staking } from '../build/Staking/tact_Staking';

export async function run(provider: NetworkProvider) {
    const staking = provider.open(await Staking.fromInit());
    await staking.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );

    await provider.waitForDeploy(staking.address);
    updateEnvFile('STAKING_ADDRESS', staking.address.toString({ urlSafe: true }));
}
