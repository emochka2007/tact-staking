import { getHttpEndpoint } from '@orbs-network/ton-access';
import TonWeb from 'tonweb';
import { Address } from '@ton/core';

export const getJettonAddress = async (from: Address, minterAddress: Address) => {
    const endpoint = await getHttpEndpoint({
        network: 'testnet',
    });
    const httpProvider = new TonWeb.HttpProvider(endpoint);
    const tonWebProvider = new TonWeb(httpProvider);
    const jettonMinter = new TonWeb.token.jetton.JettonMinter(tonWebProvider.provider, {
        // @ts-ignore
        adminAddress: undefined,
        jettonContentUri: '',
        jettonWalletCodeHex: '',
        address: minterAddress.toString(),
    });
    const jettonAddress = await jettonMinter.getJettonWalletAddress(new TonWeb.utils.Address(from.toString()));
    return jettonAddress.toString(true, true, true);
};
