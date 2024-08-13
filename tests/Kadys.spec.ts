import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import '@ton/test-utils';
import { Kadys, loadStakeEvent, loadUnstakeEvent } from '../build/Kadys/tact_Kadys';
import { JettonDefaultWallet } from '../build/Jetton/tact_JettonDefaultWallet';
import { SampleJetton } from '../build/Jetton/tact_SampleJetton';
import { mint, sendJettonTest } from './utils';
import { fromEarnedToNumber } from './number';
const secondsInDay = 24 * 60 * 60;
const secondsInWeek = 24 * 60 * 60 * 7;
const secondsInYear = 24 * 60 * 60 * 365;
describe('Kadys', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let kadys: SandboxContract<Kadys>;
    let deployerJettonWallet: SandboxContract<JettonDefaultWallet>;
    let playerJettonWallet: SandboxContract<JettonDefaultWallet>;
    let kadysJettonWallet: SandboxContract<JettonDefaultWallet>;
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
        kadys = blockchain.openContract(await Kadys.fromInit());
        yearlyPercent = 18;
        const deployResult = await kadys.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );
        kadysJettonWallet = blockchain.openContract(await JettonDefaultWallet.fromInit(minter.address, kadys.address));
        await kadys.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetContractJettonWallet',
                wallet: kadysJettonWallet.address,
            },
        );
        startDate = Math.floor(Date.now() / 1000);
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: kadys.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and kadys are ready to use
    });
    describe('Stake', () => {
        beforeEach(async () => {
            const senderWalletAddress = await minter.getGetWalletAddress(deployer.address);
            const senderWallet = blockchain.openContract(JettonDefaultWallet.fromAddress(senderWalletAddress));
            const transferResult = await sendJettonTest({
                jettonWallet: senderWallet,
                amount: toNano(100),
                sender: deployer,
                destination: kadys.address,
            });
            expect(transferResult.transactions).toHaveTransaction({
                from: kadysJettonWallet.address,
                to: kadys.address,
                success: true,
            });
        });
        it('should stake for one user', async () => {
            //test inside before each
        });
        it('should update balance after stake', async () => {
            const balance = await kadys.getBalanceOfAddress(deployer.address);
            expect(balance?.totalDeposit).toEqual(toNano(100));
        });
        it('should increase totalSupply after stake', async () => {
            const totalSupply = await kadys.getTotalSupply();
            expect(totalSupply).toEqual(toNano(100));
        });
        it('should increase earned after stake and 1 day passed', async () => {
            // move 1 day
            blockchain.now = startDate + 24 * 60 * 60;
            const earned = await kadys.getEarnedOfAddress(deployer.address);
            expect(earned).toEqual(toNano(yearlyPercent / 365));
        });
        it('should emit stakeEvent after stake', async () => {
            const stakeRes = await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: kadys.address,
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
                destination: kadys.address,
                amount: toNano(100),
            });
            const balance = await kadys.getBalanceOfAddress(deployer.address);
            expect(balance?.totalDeposit).toEqual(toNano(200));
        });
        it('should handle two stakes with 2 different accounts', async () => {
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                sender: player,
                destination: kadys.address,
                amount: toNano(33),
            });
            const deployerBalance = await kadys.getBalanceOfAddress(deployer.address);
            const playerBalance = await kadys.getBalanceOfAddress(player.address);
            expect(deployerBalance?.totalDeposit).toEqual(toNano(100));
            expect(playerBalance?.totalDeposit).toEqual(toNano(33));
        });
        it('should throw an error when msg amount is less than zero', async () => {
            const stakeRes = await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: kadys.address,
                amount: toNano(0),
            });
            expect(stakeRes.transactions).toHaveTransaction({
                from: kadysJettonWallet.address,
                success: false,
                to: kadys.address,
                exitCode: 61833,
            });
        });
    });
    describe('Unstake', () => {
        beforeEach(async () => {
            await sendJettonTest({
                jettonWallet: deployerJettonWallet,
                sender: deployer,
                destination: kadys.address,
                amount: toNano(100),
            });
            const data = await deployerJettonWallet.getGetWalletData();
            const unstakeRes = await kadys.send(
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
                to: kadys.address,
                success: true,
            });
        });
        it('should handle unstake', () => {
            // realized in beforeEach
        });
        it('should throw an error when msg amount is less or equal zero', async () => {
            const stakeRes = await kadys.send(
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
                to: kadys.address,
                exitCode: 61833,
            });
        });
        it('should throw an error if user is not defined', async () => {
            const stakeRes = await kadys.send(
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
                to: kadys.address,
                exitCode: 33670,
            });
        });
        it('should throw an error if users balance is less than amount to unstake', async () => {
            const stakeRes = await kadys.send(
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
                to: kadys.address,
                exitCode: 5157,
            });
        });
        it('should correctly update users balance', async () => {
            await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const balance = await kadys.getBalanceOfAddress(deployer.address);
            // 2 times unstake with 10 (first one is beforeEach)
            expect(balance?.totalDeposit).toEqual(toNano(80));
        });
        it('should correctly update claimed ', async () => {
            await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const claimed = await kadys.getClaimedByAddress(deployer.address);
            expect(claimed).toEqual(toNano(20));
        });
        it('should update totalSupply', async () => {
            await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            const totalSupply = await kadys.getTotalSupply();
            // 100 - 20
            expect(totalSupply).toEqual(toNano(80));
        });
        it('should emit UnstakeEvent', async () => {
            const stakeRes = await kadys.send(
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
                destination: kadys.address,
                amount: toNano(100),
            });
            await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            await kadys.send(
                player.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(25),
                },
            );
            const deployerBalance = await kadys.getBalanceOfAddress(deployer.address);
            const playerBalance = await kadys.getBalanceOfAddress(player.address);
            expect(deployerBalance?.totalDeposit).toEqual(toNano(80n));
            expect(playerBalance?.totalDeposit).toEqual(toNano(75n));
        });
        it('should correctly update balance after 2 unstakings for 1 user', async () => {
            await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(10),
                },
            );
            await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(25),
                },
            );
            const deployerBalance = await kadys.getBalanceOfAddress(deployer.address);
            expect(deployerBalance?.totalDeposit).toEqual(toNano(55));
        });
        it('should update user jetton balance after unstake', async () => {
            const deployerBalance = await deployerJettonWallet.getGetWalletData();
            console.log('=>(Kadys.spec.ts:379) deployerBalance', deployerBalance);
            await kadys.send(
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
            console.log('=>(Kadys.spec.ts:391) updateBalance', updateBalance);
            expect(updateBalance.balance).toEqual(deployerBalance.balance + toNano(10));
        });
    });
    describe('Earned', () => {
        describe('Only stake', () => {
            beforeEach(async () => {
                await sendJettonTest({
                    jettonWallet: deployerJettonWallet,
                    sender: deployer,
                    destination: kadys.address,
                    amount: toNano(1),
                });
            });
            it('should return correct earned after deposit with 1 TON and 1 day passed', async () => {
                blockchain.now = startDate + secondsInDay;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
                const earnedFromNano = Number(earned / scaleFactor);
                const expectedEarned = Number(earnedInOneDay) / Number(scaleFactor);
                expect(earnedFromNano).toBeCloseTo(expectedEarned);
            });
            it('should return correct earned after deposit with 1 TON and 1 week passed', async () => {
                blockchain.now = startDate + secondsInWeek;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
                const earnedFromNano = Number(earned / scaleFactor);
                const expectedEarned = (Number(earnedInOneDay) * 7) / Number(scaleFactor);
                expect(earnedFromNano).toBeCloseTo(expectedEarned);
            });
            it('should return correct earned after deposit with 1 TON and 1 year passed', async () => {
                blockchain.now = startDate + secondsInYear;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned = (Number(earnedInOneDay) * 365) / Number(scaleFactor);
                expect(earnedFromNano).toBeCloseTo(expectedEarned);
            });
            it('should return correct earned after deposit with 1 TON and 2 year passed', async () => {
                blockchain.now = startDate + secondsInYear;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
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
                    destination: kadys.address,
                });
                blockchain.now = blockchain.now + secondsInDay;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
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
                    destination: kadys.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
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
                    destination: kadys.address,
                });
                blockchain.now = blockchain.now + secondsInYear;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
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
                    destination: kadys.address,
                });
                blockchain.now = blockchain.now + secondsInYear;
                const earned = await kadys.getEarnedOfAddress(deployer.address);
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
                    destination: kadys.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;

                await sendJettonTest({
                    jettonWallet: playerJettonWallet,
                    amount: toNano(200),
                    sender: player,
                    destination: kadys.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;
                await sendJettonTest({
                    jettonWallet: playerJettonWallet,
                    amount: toNano(300),
                    sender: player,
                    destination: kadys.address,
                });
                blockchain.now = blockchain.now + secondsInWeek;
                const earned = await kadys.getEarnedOfAddress(player.address);
                const earnedFromNano = fromEarnedToNumber(earned);
                const expectedEarned =
                    numerizedEarnedInOneDay * 7 * 100 +
                    numerizedEarnedInOneDay * 3 * 7 * 100 +
                    numerizedEarnedInOneDay * 6 * 7 * 100;
                expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
            });
        });
        it('should return correct earned after deposit and unstake', async () => {
            blockchain.now = startDate + secondsInDay;
            await sendJettonTest({
                jettonWallet: playerJettonWallet,
                amount: toNano(100),
                sender: player,
                destination: kadys.address,
            });
            blockchain.now = blockchain.now + secondsInWeek;

            await kadys.send(
                player.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Unstake',
                    amount: toNano(50),
                },
            );
            blockchain.now = blockchain.now + secondsInWeek;

            const earned = await kadys.getEarnedOfAddress(player.address);
            const earnedFromNano = fromEarnedToNumber(earned);
            const expectedEarned = numerizedEarnedInOneDay * 7 * 100 + numerizedEarnedInOneDay * 7 * 50;
            expect(earnedFromNano).toBeCloseTo(expectedEarned / Number(scaleFactor));
        });
    });
    describe('ChangeYearlyPercent', () => {
        it('should change yearly percent', async () => {
            const res = await kadys.send(
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
                to: kadys.address,
                success: true,
            });
        });
        it('should not change yearly percent when called not by deployer', async () => {
            const res = await kadys.send(
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
                to: kadys.address,
                success: false,
                exitCode: 22276,
            });
        });
        it('should not change yearly percent when is out of range', async () => {
            const res = await kadys.send(
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
                to: kadys.address,
                success: false,
                exitCode: 53383,
            });
        });
    });
    describe('Withdraw', () => {
        it('should withdraw correct sum when called by owner', async () => {
            await deployer.send({
                value: toNano('30'),
                to: kadys.address,
            });
            const initialBalance = await kadys.getBalance();
            const response = await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Withdraw',
                    amount: toNano('10'),
                },
            );
            const currentBalance = await kadys.getBalance();
            expect(Number(currentBalance) / Number(scaleFactor)).toBeCloseTo(
                Number(initialBalance) / Number(scaleFactor) - 10,
                0,
            );
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: kadys.address,
                success: true,
            });
        });
        it('should not withdraw when called not by owner', async () => {
            await deployer.send({
                value: toNano('30'),
                to: kadys.address,
            });
            const initialBalance = await kadys.getBalance();
            const response = await kadys.send(
                player.getSender(),
                {
                    value: toNano('0.5'),
                },
                {
                    $$type: 'Withdraw',
                    amount: toNano('10'),
                },
            );
            const currentBalance = await kadys.getBalance();
            expect(currentBalance).toEqual(initialBalance);
            expect(response.transactions).toHaveTransaction({
                from: player.address,
                to: kadys.address,
                success: false,
                exitCode: 27921,
            });
        });
        it('should throw an error when trying to withdraw more than balance', async () => {
            await deployer.send({
                value: toNano('30'),
                to: kadys.address,
            });
            const initialBalance = await kadys.getBalance();
            const response = await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.5'),
                },
                {
                    $$type: 'Withdraw',
                    amount: toNano('100'),
                },
            );
            const currentBalance = await kadys.getBalance();
            const numBalance = fromEarnedToNumber(currentBalance);
            const initNumBalance = fromEarnedToNumber(initialBalance);
            expect(numBalance).toBeCloseTo(initNumBalance);
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: kadys.address,
                success: false,
                exitCode: 10603,
            });
        });
    });

    describe('WithdrawEarned', () => {
        beforeEach(async () => {
            await sendJettonTest({
                destination: kadys.address,
                sender: deployer,
                amount: toNano(100),
                jettonWallet: deployerJettonWallet,
            });
        });
        it('should withdraw and update rewards', async () => {
            const initialJettonData = await deployerJettonWallet.getGetWalletData();
            blockchain.now = startDate + secondsInYear;
            const earned = await kadys.getEarnedOfAddress(deployer.address);
            const earnedFromNano = fromEarnedToNumber(earned);
            const expectedEarned = (Number(earnedInOneDay) * 100 * 365) / Number(scaleFactor);
            expect(earnedFromNano).toBeCloseTo(expectedEarned);
            const response = await kadys.send(
                deployer.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'WithdrawEarned',
                    amount: toNano('1'),
                },
            );
            const afterWithdrawJettonData = await deployerJettonWallet.getGetWalletData();
            console.log('=>(Kadys.spec.ts:736) afterWithdrawJettonData', afterWithdrawJettonData);
            expect(afterWithdrawJettonData.balance).toBe(initialJettonData.balance + toNano(1));
            expect(response.transactions).toHaveTransaction({
                from: deployer.address,
                to: kadys.address,
                success: true,
            });
            const earnedAfterWithdraw = await kadys.getEarnedOfAddress(deployer.address);
            const earnedAfterWithdrawFromNano = fromEarnedToNumber(earnedAfterWithdraw);
            expect(earnedAfterWithdrawFromNano).toEqual(earnedFromNano - 1);
        });
        it('should not withdraw when called with value more than available', async () => {
            blockchain.now = startDate + secondsInYear;
            const response = await kadys.send(
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
                to: kadys.address,
                success: false,
                exitCode: 15241,
            });
        });
        it('should withdraw when called with zero value', async () => {
            blockchain.now = startDate + secondsInYear;
            const response = await kadys.send(
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
                to: kadys.address,
                success: false,
                exitCode: 61833,
            });
        });
    });
});
