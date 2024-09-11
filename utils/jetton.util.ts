import { getHttpEndpoint } from '@orbs-network/ton-access';
import TonWeb from 'tonweb';
import { Address } from '@ton/core';

export const getJettonAddress = async (from: Address, masterAddress: Address) => {
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
        address: masterAddress.toString(),
    });
    const jettonAddress = await jettonMinter.getJettonWalletAddress(new TonWeb.utils.Address(from.toString()));
    return jettonAddress.toString(true, true, true);
};
export const getJettonData = async (from: Address) => {
    const endpoint = await getHttpEndpoint({
        network: 'testnet',
    });
    const httpProvider = new TonWeb.HttpProvider(endpoint);
    const tonWebProvider = new TonWeb(httpProvider);
    const wallet = new TonWeb.token.jetton.JettonWallet(tonWebProvider.provider, {
        // @ts-ignore
        adminAddress: undefined,
        jettonContentUri: '',
        jettonWalletCodeHex: '',
        address: from.toString(),
    });
    return await wallet.getData();
};
