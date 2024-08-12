import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address, beginCell, toNano } from '@ton/core';
import { TransactionStatus, WithdrawalType } from '@prisma/client';
import { prisma } from '../wrappers/prisma';
import { runShell } from '../src/utils/bash';
export async function run(provider: NetworkProvider) {
  console.log('=>(unstake.ts:9) provider', provider);
  /**
   * Get all Pending withdrawal from db
   * and send unstake message to staking contract
   */
  const kadysAddress = process.env.KADYS_ADDRESS;
  const ownerWallet = process.env.OWNER_ADDRESS;
  const hotWalletAddress = process.env.HOT_WALLET_ADDRESS;
  const kadys = provider.open(Kadys.fromAddress(Address.parse(kadysAddress)));
  const pendingWithdrawal = await prisma.withdrawal.findFirst({
    where: {
      status: TransactionStatus.PENDING,
      type: WithdrawalType.UNSTAKE,
    },
  });
  if (pendingWithdrawal === null) {
    throw new Error('Pending withdrawal not found');
  }
  const deposited = await kadys.getBalanceOfAddress(
    Address.parse(pendingWithdrawal.to),
  );
  console.log('=>(unstake.ts:28) deposited', deposited);
  if (deposited.totalDeposit < pendingWithdrawal.amount) {
    throw new Error(
      `Invalid amount to withdraw. Available is ${Number(deposited.totalDeposit)}. Withdrawal is ${pendingWithdrawal.amount}`,
    );
  }
  const sender = provider.sender();
  await kadys.send(
    sender,
    {
      value: toNano('0.05'),
    },
    {
      $$type: 'Unstake',
      amount: pendingWithdrawal.amount,
    },
  );
  await runShell('npx blueprint run sendRub --mainnet --mnemonic');
  //TODO change to tonconnect
  await prisma.withdrawal.update({
    where: {
      id: pendingWithdrawal.id,
    },
    data: {
      status: TransactionStatus.SENT,
    },
  });
}
