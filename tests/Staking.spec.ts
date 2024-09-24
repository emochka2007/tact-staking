import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { JettonDefaultWallet } from '../build/Jetton/tact_JettonDefaultWallet';
import { SampleJetton } from '../build/Jetton/tact_SampleJetton';
import { mint, sendJettonTest } from './utils';
import { fromEarnedToNumber } from './number';
import { loadStakeEvent, loadUnstakeEvent, Staking } from '../build/Staking/tact_Staking';

const secondsInDay = 24 * 60 * 60;
const secondsInWeek = 24 * 60 * 60 * 7;
const secondsInYear = 24 * 60 * 60 * 365;
describe('Staking', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let staking: SandboxContract<Staking>;
    let deployerJettonWallet: SandboxContract<JettonDefaultWallet>;
    let playerJettonWallet: SandboxContract<JettonDefaultWallet>;
    let stakingJettonWallet: SandboxContract<JettonDefaultWallet>;
    let minter: SandboxContract<SampleJetton>;
    let player: SandboxContract<TreasuryContract>;
    let startDate: number;
    let yearlyPercent: number;
    const scaleFactor = toNano(1);
    const earnedInOneDay = toNano(0.18 / 365);
    const numerizedEarnedInOneDay = Number(earnedInOneDay);
    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        player = await blockchain.treasury('player');
        minter = blockchain.openContract(
            await SampleJetton.fromInit(deployer.address, beginCell().storeUint(0, 64).endCell(), toNano(100000000000)),
        );
        const deployerMintResult = await mint({
            deployer,
            minter,
            receiverAddress: deployer.address,
            amount: toNano(1000),
        });
        expect(deployerMintResult.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: minter.address,
        });
        const playerMintResult = await mint({
            deployer,
            minter,
            receiverAddress: player.address,
            amount: toNano(1000),
        });
        expect(playerMintResult.transactions).toHaveTransaction({
            success: true,
            from: deployer.address,
            to: minter.address,
        });
        deployerJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(minter.address, deployer.address),
        );
        playerJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(minter.address, player.address),
        );
        staking = blockchain.openContract(await Staking.fromInit());
        yearlyPercent = 18;
        const deployResult = await staking.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );
        stakingJettonWallet = blockchain.openContract(
            await JettonDefaultWallet.fromInit(minter.address, staking.address),
        );
        await staking.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetContractJettonWallet',
                wallet: stakingJettonWallet.address,
            },
        );
        const stakingMinResult = await mint({
            deployer,
            minter,
            receiverAddress: staking.address,
            amount: toNano(1000),
        });
        expect(stakingMinResult.transactions).toHaveTransaction({
            success: true,
            from: minter.address,
            to: stakingJettonWallet.address,
        });
        startDate = Math.floor(Date.now() / 1000);
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: staking.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
    });
    describe('Stake', () => {
        beforeEach(async () => {
            const senderWalletAddress = await minter.getGetWalletAddress(deployer.address);
            const senderWallet = blockchain.openContract(JettonDefaultWallet.fromAddress(senderWalletAddress));
            const balance = await staking.getBalanceOfAddress(deployer.address);
            const transferResult = await sendJettonTest({
                jettonWallet: senderWallet,
                amount: toNano(100),
                sender: deployer,
                destination: staking.address,
            });

            expect(transferResult.transactions).toHaveTransaction({
                from: stakingJettonWallet.address,
                to: staking.address,
                success: true,
            });
        });
        it('should stake for one user', async () => {
            //test inside before each
        });
        it('should update balance after stake', async () => {
            const balance = await staking.getBalanceOfAddress(deployer.address);
            expect(balance?.totalDeposit).toEqual(toNano(100));
        });
        it('should increase totalSupply after stake', async () => {
            const totalSupply = await staking.getTotalSupply();
            expect(totalSupply).toEqual(toNano(100));
        });
        it('should increase earned after stake and 1 day passed', async () => {
            // move 1 day
            blockchain.now = startDate + 24 * 60 * 60;
            const earned = await staking.getEarnedOfAddress(deployer.address);
            expect(earned).toEqual(toNano(yearlyPercent / 365));
        });
        it('should emit stakeEvent after stake', async () => {
            const stakeRes = await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: staking.address,
                amount: toNano(100),
            });
            stakeRes.externals.forEach((ext) => {
                expect(loadStakeEvent(ext.body.asSlice()).$$type).toEqual('StakeEvent');
            });
        });
        it('should sum two stake 100 for 1 account into 200', async () => {
            await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: staking.address,
                amount: toNano(100),
            });
            const balance = await staking.getBalanceOfAddress(deployer.address);
            expect(balance?.totalDeposit).toEqual(toNano(200));
        });
        it('should handle two stakes with 2 different accounts', async () => {
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                sender: player,
                destination: staking.address,
                amount: toNano(33),
            });
            const deployerBalance = await staking.getBalanceOfAddress(deployer.address);
            const playerBalance = await staking.getBalanceOfAddress(player.address);
            expect(deployerBalance?.totalDeposit).toEqual(toNano(100));
            expect(playerBalance?.totalDeposit).toEqual(toNano(33));
        });
        it('should throw an error when msg amount is less than zero', async () => {
            const stakeRes = await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: staking.address,
                amount: toNano(0),
            });
            expect(stakeRes.transactions).toHaveTransaction({
                from: stakingJettonWallet.address,
                success: false,
                to: staking.address,
                exitCode: 61833,
            });
        });
    });
    describe('Unstake', () => {
        beforeEach(async () => {
            await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: staking.address,
                amount: toNano(100),
            });
            const data = await deployerJettonWallet.getGetWalletData();
            const unstakeRes = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const unstakeData = await deployerJettonWallet.getGetWalletData();
            expect(unstakeData.balance).toBe(data.balance + toNano(10));
            expect(unstakeRes.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
        });
        it('should handle unstake', () => {
            // realized in beforeEach
        });
        it('should throw an error when msg amount is less or equal zero', async () => {
            const stakeRes = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(0),
                },
            );
            expect(stakeRes.transactions).toHaveTransaction({
                from: deployer.address,
                success: false,
                to: staking.address,
                exitCode: 61833,
            });
        });
        it('should throw an error if user is not defined', async () => {
            const stakeRes = await staking.send(
                player.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(100),
                },
            );
            expect(stakeRes.transactions).toHaveTransaction({
                from: player.address,
                success: false,
                to: staking.address,
                exitCode: 33670,
            });
        });
        it('should throw an error if users balance is less than amount to unstake', async () => {
            const stakeRes = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(999),
                },
            );
            expect(stakeRes.transactions).toHaveTransaction({
                from: deployer.address,
                success: false,
                to: staking.address,
                exitCode: 5157,
            });
        });
        it('should correctly update users balance', async () => {
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const balance = await staking.getBalanceOfAddress(deployer.address);
            // 2 times unstake with 10 (first one is beforeEach)
            expect(balance?.totalDeposit).toEqual(toNano(80));
        });
        it('should correctly update claimed ', async () => {
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const claimed = await staking.getClaimedByAddress(deployer.address);
            expect(claimed).toEqual(toNano(20));
        });
        it('should update totalSupply', async () => {
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const totalSupply = await staking.getTotalSupply();
            // 100 - 20
            expect(totalSupply).toEqual(toNano(80));
        });
        it('should emit UnstakeEvent', async () => {
            const stakeRes = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            stakeRes.externals.forEach((ext) => {
                expect(loadUnstakeEvent(ext.body.asSlice()).$$type).toEqual('UnstakeEvent');
            });
        });
        it('should correctly update 2 users after 2 unstaking', async () => {
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                sender: player,
                destination: staking.address,
                amount: toNano(100),
            });
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            await staking.send(
                player.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(25),
                },
            );
            const deployerBalance = await staking.getBalanceOfAddress(deployer.address);
            const playerBalance = await staking.getBalanceOfAddress(player.address);
            expect(deployerBalance?.totalDeposit).toEqual(toNano(80n));
            expect(playerBalance?.totalDeposit).toEqual(toNano(75n));
        });
        it('should correctly update balance after 2 unstakings for 1 user', async () => {
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(25),
                },
            );
            const deployerBalance = await staking.getBalanceOfAddress(deployer.address);
            expect(deployerBalance?.totalDeposit).toEqual(toNano(55));
        });
        it('should update user jetton balance after unstake', async () => {
            const deployerBalance = await deployerJettonWallet.getGetWalletData();
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const updateBalance = await deployerJettonWallet.getGetWalletData();
            expect(updateBalance.balance).toEqual(deployerBalance.balance + toNano(10));
        });
    });
    describe('Earned', () => {
        describe('Only stake', () => {
            beforeEach(async () => {
                await sendJettonTest({
                    jettonWallet: deployerJettonWallet,
                    sender: deployer,
                    destination: staking.address,
                    amount: toNano(1),
                });
            });
            it('should return correct earned after deposit with 1 TON and 1 day passed', async () => {
                blockchain.now = startDate + secondsInDay;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = Number(earned / scaleFactor);
                const expectedEarned = Number(earnedInOneDay) / Number(scaleFactor);
                expect(earnedFromNano).toBeCloseTo(expectedEarned);
            });
            it('should return correct earned after deposit with 1 TON and 1 week passed', async () => {
                blockchain.now = startDate + secondsInWeek;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = Number(earned / scaleFactor);
                const expectedEarned = (Number(earnedInOneDay) * 7) / Number(scaleFactor);
                expect(earnedFromNano).toBeCloseTo(expectedEarned);
            });
            it('should return correct earned after deposit with 1 TON and 1 year passed', async () => {
                blockchain.now = startDate + secondsInYear;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned = (Number(earnedInOneDay) * 365) / Number(scaleFactor);
                expect(earnedFromNano).toBeCloseTo(expectedEarned);
            });
            it('should return correct earned after deposit with 1 TON and 2 year passed', async () => {
                blockchain.now = startDate + secondsInYear;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned = (Number(earnedInOneDay) * 365) / Number(scaleFactor);
                expect(earnedFromNano).toBeCloseTo(expectedEarned);
            });
            it('should return correct earned after 2 deposit with 1 TON with 1 day gap', async () => {
                blockchain.now = startDate + secondsInDay;
                await sendJettonTest({
                    jettonWallet: deployerJettonWallet,
                    amount: toNano(1),
                    sender: deployer,
                    destination: staking.address,
                });
                blockchain.now = blockchain.now + secondsInDay;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned =
                    //18/365 + 36/365
                    Number(earnedInOneDay) + Number(earnedInOneDay) * 2;
                expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
            });
            it('should return correct earned after 2 deposit with 1 TON with 1 week gap', async () => {
                blockchain.now = startDate + secondsInWeek;
                await sendJettonTest({
                    jettonWallet: deployerJettonWallet,
                    amount: toNano(1),
                    sender: deployer,
                    destination: staking.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned = Number(earnedInOneDay) * 7 + Number(earnedInOneDay) * 2 * 7;
                expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
            });
            it('should return correct earned after 2 deposit with 1 TON with 1 year gap', async () => {
                blockchain.now = startDate + secondsInYear;
                await sendJettonTest({
                    jettonWallet: deployerJettonWallet,
                    amount: toNano(1),
                    sender: deployer,
                    destination: staking.address,
                });
                blockchain.now = blockchain.now + secondsInYear;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned = Number(earnedInOneDay) * 365 + Number(earnedInOneDay) * 2 * 365;
                expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
            });
            it('should return correct earned after 2 deposit with 1 TON with 2 years gap', async () => {
                blockchain.now = startDate + secondsInYear;
                await sendJettonTest({
                    jettonWallet: deployerJettonWallet,
                    amount: toNano(1),
                    sender: deployer,
                    destination: staking.address,
                });
                blockchain.now = blockchain.now + secondsInYear;
                const earned = await staking.getEarnedOfAddress(deployer.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned = Number(earnedInOneDay) * 365 + Number(earnedInOneDay) * 2 * 365;
                expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
            });
            it('should return correct earned after 5 deposits with diff value and 1 week gap', async () => {
                blockchain.now = startDate + secondsInDay;
                await sendJettonTest({
                    jettonWallet: playerJettonWallet,
                    amount: toNano(100),
                    sender: player,
                    destination: staking.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;

                await sendJettonTest({
                    jettonWallet: playerJettonWallet,
                    amount: toNano(200),
                    sender: player,
                    destination: staking.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;
                await sendJettonTest({
                    jettonWallet: playerJettonWallet,
                    amount: toNano(300),
                    sender: player,
                    destination: staking.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;
                const earned = await staking.getEarnedOfAddress(player.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned =
                    numerizedEarnedInOneDay * 7 * 100 +
                    numerizedEarnedInOneDay * 3 * 7 * 100 +
                    numerizedEarnedInOneDay * 6 * 7 * 100;
                expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
            });
        });
    });
    describe('ChangeYearlyPercent', () => {
        it('should change yearly percent', async () => {
            const res = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'ChangeYearlyPercent',
                    newPercent: 2000n,
                },
            );
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
            const newPercent = await staking.getYearlyPercent();
            expect(newPercent).toEqual(2000n);
        });
        it('should change to float yearly percent', async () => {
            const res = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'ChangeYearlyPercent',
                    newPercent: 2050n,
                },
            );
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
            const newPercent = await staking.getYearlyPercent();
            expect(newPercent).toEqual(2050n);
        });
        it('should not change yearly percent when called not by deployer', async () => {
            const res = await staking.send(
                player.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'ChangeYearlyPercent',
                    newPercent: 2000n,
                },
            );
            expect(res.transactions).toHaveTransaction({
                from: player.address,
                to: staking.address,
                success: false,
                exitCode: 22276,
            });
        });
        it('should not change yearly percent when is out of range', async () => {
            const res = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'ChangeYearlyPercent',
                    newPercent: 0n,
                },
            );
            expect(res.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: false,
                exitCode: 53383,
            });
        });
        it('should correctly sum earned after changing yearly percent', async () => {
            blockchain.now = startDate + secondsInWeek;
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                amount: toNano(100),
                sender: player,
                destination: staking.address,
            });
            blockchain.now = blockchain.now + secondsInWeek;
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                amount: toNano(200),
                sender: player,
                destination: staking.address,
            });
            blockchain.now = blockchain.now + secondsInWeek;
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'ChangeYearlyPercent',
                    newPercent: 2500n,
                },
            );
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                amount: toNano(300),
                sender: player,
                destination: staking.address,
            });
            blockchain.now = blockchain.now + secondsInWeek;
            const earnedInOneDay = toNano(0.18 / 365);
            const newEarnedInOneDay = Number(toNano(0.25 / 365));
            const numerizedEarnedInOneDay = Number(earnedInOneDay);
            const earned = await staking.getEarnedOfAddress(player.address);
            const earnedFromNano = fromEarnedToNumber(earned);
            const expectedEarned =
                numerizedEarnedInOneDay * 7 * 100 +
                numerizedEarnedInOneDay * 3 * 7 * 100 +
                newEarnedInOneDay * 6 * 7 * 100;
            expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
        });
        it('should correctly change after setting float values', async () => {
            blockchain.now = startDate + secondsInWeek;
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                amount: toNano(100),
                sender: player,
                destination: staking.address,
            });
            blockchain.now = blockchain.now + secondsInWeek;
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                amount: toNano(200),
                sender: player,
                destination: staking.address,
            });
            blockchain.now = blockchain.now + secondsInWeek;
            await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'ChangeYearlyPercent',
                    newPercent: 2550n,
                },
            );
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                amount: toNano(300),
                sender: player,
                destination: staking.address,
            });
            blockchain.now = blockchain.now + secondsInWeek;
            const earnedInOneDay = toNano(0.18 / 365);
            const newEarnedInOneDay = Number(toNano(0.255 / 365));
            const numerizedEarnedInOneDay = Number(earnedInOneDay);
            const earned = await staking.getEarnedOfAddress(player.address);
            const earnedFromNano = fromEarnedToNumber(earned);
            const expectedEarned =
                numerizedEarnedInOneDay * 7 * 100 +
                numerizedEarnedInOneDay * 3 * 7 * 100 +
                newEarnedInOneDay * 6 * 7 * 100;
            expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
        });
    });
    describe('Withdraw', () => {
        it('should withdraw correct sum when called by owner', async () => {
            await deployer.send({
                value: toNano('30'),
                to: staking.address,
            });
            const initialBalance = await staking.getBalance();
            const response = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Withdraw',
                    amount: toNano('10'),
                },
            );
            const currentBalance = await staking.getBalance();
            expect(Number(currentBalance) / Number(scaleFactor)).toBeCloseTo(
                Number(initialBalance) / Number(scaleFactor) - 10,
                0,
            );
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
        });
        it('should not withdraw when called not by owner', async () => {
            await deployer.send({
                value: toNano('30'),
                to: staking.address,
            });
            const initialBalance = await staking.getBalance();
            const response = await staking.send(
                player.getSender(),
                {
                    value: toNano('0.5'),
                },
                {
                    $$type: 'Withdraw',
                    amount: toNano('10'),
                },
            );
            const currentBalance = await staking.getBalance();
            expect(currentBalance).toBeGreaterThanOrEqual(initialBalance);
            expect(response.transactions).toHaveTransaction({
                from: player.address,
                to: staking.address,
                success: false,
                exitCode: 27921,
            });
        });
        it('should throw an error when trying to withdraw more than balance', async () => {
            await deployer.send({
                value: toNano('30'),
                to: staking.address,
            });
            const initialBalance = await staking.getBalance();
            const response = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.5'),
                },
                {
                    $$type: 'Withdraw',
                    amount: toNano('100'),
                },
            );
            const currentBalance = await staking.getBalance();
            const numBalance = fromEarnedToNumber(currentBalance);
            const initNumBalance = fromEarnedToNumber(initialBalance);
            expect(numBalance).toBeCloseTo(initNumBalance);
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: false,
                exitCode: 10603,
            });
        });
    });

    describe('WithdrawEarned', () => {
        beforeEach(async () => {
            await sendJettonTest({
                destination: staking.address,
                sender: deployer,
                amount: toNano(100),
                jettonWallet: deployerJettonWallet,
            });
        });
        it('should withdraw and update rewards', async () => {
            const initialJettonData = await deployerJettonWallet.getGetWalletData();
            blockchain.now = startDate + secondsInYear;
            const earned = await staking.getEarnedOfAddress(deployer.address);
            const earnedFromNano = fromEarnedToNumber(earned);
            const expectedEarned = (Number(earnedInOneDay) * 100 * 365) / Number(scaleFactor);
            expect(earnedFromNano).toBeCloseTo(expectedEarned);
            const response = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.2'),
                },
                {
                    $$type: 'WithdrawEarned',
                    amount: toNano('10'),
                },
            );
            const afterWithdrawJettonData = await deployerJettonWallet.getGetWalletData();
            expect(afterWithdrawJettonData.balance).toBe(initialJettonData.balance + toNano(10));
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
            const earnedAfterWithdraw = await staking.getEarnedOfAddress(deployer.address);
            const earnedAfterWithdrawFromNano = fromEarnedToNumber(earnedAfterWithdraw);
            expect(earnedAfterWithdrawFromNano).toEqual(earnedFromNano - 10);
        });
        it('should not withdraw when called with value more than available', async () => {
            blockchain.now = startDate + secondsInYear;
            const response = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawEarned',
                    amount: toNano('20'),
                },
            );

            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: false,
                exitCode: 15241,
            });
        });
        it('should not withdraw when called with zero value', async () => {
            blockchain.now = startDate + secondsInYear;
            const response = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawEarned',
                    amount: 0n,
                },
            );

            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: false,
                exitCode: 61833,
            });
        });
    });
    describe('Withdraw Jetton', () => {
        beforeEach(async () => {
            const senderWalletAddress = await minter.getGetWalletAddress(deployer.address);
            const senderWallet = blockchain.openContract(JettonDefaultWallet.fromAddress(senderWalletAddress));
            const transferResult = await sendJettonTest({
                jettonWallet: senderWallet,
                amount: toNano(100),
                sender: deployer,
                destination: staking.address,
            });
            expect(transferResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: senderWallet.address,
                success: true,
            });
        });
        it('should withdraw when called by deployer', async () => {
            const balance = await playerJettonWallet.getGetWalletData();
            const withdrawResult = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawJetton',
                    amount: toNano('50'),
                    to: player.address,
                },
            );
            // console.log('staking jetton ', staking.address); //RZ
            // console.log('player jetton ', playerJettonWallet.address); //jF
            // console.log(' deployer ', deployer.address); //8g
            // console.log('staking jetton ', stakingJettonWallet.address); //HI
            // console.log('player  ', player.address); //ez
            const newBalance = await playerJettonWallet.getGetWalletData();
            expect(newBalance.balance).toBe(balance.balance + toNano('50'));
            expect(withdrawResult.transactions).toHaveTransaction({
                from: stakingJettonWallet.address,
                to: playerJettonWallet.address,
                success: true,
            });
        });
        it('should throw an error when called not by deployer', async () => {
            const withdrawResult = await staking.send(
                player.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawJetton',
                    amount: toNano('50'),
                    to: player.address,
                },
            );
            const newBalance = await playerJettonWallet.getGetWalletData();
            expect(newBalance.balance).toBe(toNano(1000));
            expect(withdrawResult.transactions).toHaveTransaction({
                from: player.address,
                to: staking.address,
                success: false,
                exitCode: 31741,
            });
        });
    });
    describe('WithdrawAll', () => {
        beforeEach(async () => {
            await sendJettonTest({
                destination: staking.address,
                sender: deployer,
                amount: toNano(100),
                jettonWallet: deployerJettonWallet,
            });
        });
        it('should correct withdraw', async () => {
            const initialJettonData = await deployerJettonWallet.getGetWalletData();
            blockchain.now = startDate + secondsInWeek;
            const earned = await staking.getEarnedOfAddress(deployer.address);
            const earnedFromNano = fromEarnedToNumber(earned);
            const expectedEarned = (Number(earnedInOneDay) * 100 * 7) / Number(scaleFactor);
            expect(earnedFromNano).toBeCloseTo(expectedEarned);
            const response = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawAll',
                },
            );
            const afterWithdrawJettonData = await deployerJettonWallet.getGetWalletData();
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
            expect(afterWithdrawJettonData.balance).toBe(initialJettonData.balance + toNano(100) + earned);
        });
        it('should empty balanceOf & earned', async () => {
            blockchain.now = startDate + secondsInWeek;
            const response = await staking.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawAll',
                },
            );
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
            const balanceOf = await staking.getBalanceOfAddress(deployer.address);
            expect(balanceOf?.totalDeposit).toBe(0n);
            const earned = await staking.getEarnedOfAddress(deployer.address);
            expect(earned).toBe(0n);
        });
    });
    describe('getYearlyPercent', () => {
        it('should return correct yearly percent', async () => {
            expect(await staking.getYearlyPercent()).toEqual(1800n);
        });
    });
    describe('2 stake and after withdraw', () => {
        it('should correctly update balances after staking and withdrawal', async () => {
            const player2 = await blockchain.treasury('player2');
            const player2JettonWallet = blockchain.openContract(
                await JettonDefaultWallet.fromInit(minter.address, player2.address),
            );
            console.log(`Player 2 ${player2.address}\n Deployer ${deployer.address}\n Player ${player.address}`);
            await mint({
                deployer,
                minter,
                receiverAddress: player.address,
                amount: toNano(10000),
            });
            await mint({
                deployer,
                minter,
                receiverAddress: player2.address,
                amount: toNano(10000),
            });
            await mint({
                deployer,
                minter,
                receiverAddress: deployer.address,
                amount: toNano(10000),
            });
            await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: staking.address,
                amount: toNano(500),
            });
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                sender: player,
                destination: staking.address,
                amount: toNano(1500),
            });
            await sendJettonTest({
                jettonWallet: player2JettonWallet,
                sender: player2,
                destination: staking.address,
                amount: toNano(1000),
            });
            const withdrawJettonResponse = await staking.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'WithdrawJetton',
                    amount: toNano(1000),
                    to: deployer.address,
                },
            );
            expect(withdrawJettonResponse.transactions).toHaveTransaction({
                from: deployer.address,
                to: staking.address,
                success: true,
            });
            expect(withdrawJettonResponse.transactions).toHaveTransaction({
                from: staking.address,
                to: stakingJettonWallet.address,
                success: true,
            });
            expect(withdrawJettonResponse.transactions).toHaveTransaction({
                from: stakingJettonWallet.address,
                to: deployerJettonWallet.address,
                success: true,
            });
            const unstakePlayerResponse = await staking.send(
                player.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawAll',
                },
            );
            expect(unstakePlayerResponse.transactions).toHaveTransaction({
                from: player.address,
                to: staking.address,
                success: true,
            });
            expect(unstakePlayerResponse.transactions).toHaveTransaction({
                from: staking.address,
                to: stakingJettonWallet.address,
                success: true,
            });
            expect(unstakePlayerResponse.transactions).toHaveTransaction({
                from: stakingJettonWallet.address,
                to: playerJettonWallet.address,
                success: true,
            });
        });
    });
});
