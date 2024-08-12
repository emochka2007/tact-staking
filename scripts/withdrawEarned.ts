import { NetworkProvider } from '@ton/blueprint';
import { Kadys } from '../build/Kadys/tact_Kadys';
import { Address, beginCell, toNano } from '@ton/core';
import { TransactionStatus, WithdrawalType } from '@prisma/client';
import { prisma } from '../wrappers/prisma';
import { fromEarnedToNumber } from '../src/utils/number';
export const SCALE_FACTOR = toNano(1);
export async function run(provider: NetworkProvider) {
  /**
   * Get all Pending withdrawal from db
   * and send unstake message to staking contract
   */
  const kadysAddress = process.env.KADYS_ADDRESS;
  const ownerWallet = process.env.OWNER_ADDRESS;
  const kadys = provider.open(Kadys.fromAddress(Address.parse(kadysAddress)));
  const pendingWithdrawal = await prisma.withdrawal.findFirst({
    where: {
      status: TransactionStatus.PENDING,
      type: WithdrawalType.EARNED,
    },
  });
  if (pendingWithdrawal === null) {
    throw new Error('Pending withdrawal not found');
  }
  const earned = await kadys.getEarned(Address.parse(pendingWithdrawal.to));
  const parsedEarned = fromEarnedToNumber(earned);
  if (parsedEarned < pendingWithdrawal.amount / SCALE_FACTOR) {
    throw new Error(
      `Invalid amount to withdraw. Available is ${parsedEarned}. Withdrawal is ${pendingWithdrawal.amount}`,
    );
  }
  await provider.sender().send({
    value: toNano('0.05'),
    // Owner wallet
    sendMode: 1,
    to: Address.parse(ownerWallet),
    body: beginCell()
      // # op code for jetton transfer message
      .storeUint(0xf8a7ea5, 32)
      .storeUint(Date.now(), 64) // query_id
      .storeCoins(pendingWithdrawal.amount)
      // destination address
      .storeAddress(Address.parse(pendingWithdrawal.to))
      // //# address send excess to
      .storeAddress(provider.sender().address)
      // // custom payload
      .storeUint(0, 1)
      // //# forward amount
      .storeCoins(1)
      // //# forward payload
      .storeUint(0, 1)
      //# end cell
      .endCell(),
  });
  await kadys.send(
    provider.sender(),
    {
      value: toNano('0.05'),
    },
    {
      $$type: 'WithdrawEarned',
      amount: pendingWithdrawal.amount,
      address: Address.parse(pendingWithdrawal.to),
    },
  );
  await prisma.withdrawal.update({
    where: {
      id: pendingWithdrawal.id,
    },
    data: {
      status: TransactionStatus.SENT,
    },
  });
}
