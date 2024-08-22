import { Address, beginCell, toNano } from '@ton/core';
import { SandboxContract, TreasuryContract } from '@ton/sandbox';
import { NetworkProvider } from '@ton/blueprint';
import { JettonDefaultWallet, Mint } from '../build/Jetton/tact_JettonDefaultWallet';
import { SampleJetton } from '../build/Jetton/tact_SampleJetton';
import { getJettonAddress } from '../utils/jetton.util';
export const SCALE_FACTOR = toNano(1);
type SendJettonTestProps = {
    jettonWallet: SandboxContract<JettonDefaultWallet>;
    sender: SandboxContract<TreasuryContract>;
    destination: Address;
    amount: bigint;
};
export const sendJettonTest = async ({ jettonWallet, sender, amount, destination }: SendJettonTestProps) => {
    return await jettonWallet.send(
        sender.getSender(),
        {
            value: toNano('0.5'),
        },
        {
            $$type: 'TokenTransfer',
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            amount,
            // staking contract
            destination: destination,
            // !!walletv4 address
            response_destination: sender.address,
            custom_payload: null,
            forward_ton_amount: toNano('0.1'),
            // Body to be called on staking contract
            forward_payload: beginCell().storeUint(0xf8a7ea5, 32).endCell().beginParse(),
        },
    );
};
export type MintProps = {
    deployer: SandboxContract<TreasuryContract>;
    receiverAddress: Address;
    minter: SandboxContract<SampleJetton>;
    amount: bigint;
};
export const mint = async ({ deployer, minter, receiverAddress, amount }: MintProps) => {
    const mint: Mint = {
        $$type: 'Mint',
        amount,
        receiver: receiverAddress,
    };
    return await minter.send(deployer.getSender(), { value: toNano('0.05') }, mint);
};
type SendJettonProps = {
    provider: NetworkProvider;
    destination: Address;
    amount: bigint;
};
export const sendJetton = async ({ provider, destination, amount }: SendJettonProps) => {
    const minterAddress = Address.parse(process.env.JETTON_MASTER!!);
    const hotWallet = Address.parse(process.env.OWNER_ADDRESS!!);
    const ownerJetton = await getJettonAddress(hotWallet, minterAddress);
    const jettonWallet = provider.open(JettonDefaultWallet.fromAddress(Address.parse(ownerJetton)));
    return await jettonWallet.send(
        provider.sender(),
        {
            value: toNano('0.5'),
        },
        {
            $$type: 'TokenTransfer',
            queryId: BigInt(Math.floor(Date.now() / 1000)),
            amount,
            // staking contract
            destination,
            // !!walletv4 address
            response_destination: provider.sender().address!!,
            custom_payload: null,
            forward_ton_amount: toNano('0.1'),
            // Body to be called on staking contract
            forward_payload: beginCell().storeUint(0xf8a7ea5, 32).endCell().beginParse(),
        },
    );
};
