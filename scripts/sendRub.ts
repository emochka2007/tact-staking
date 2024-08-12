import { NetworkProvider } from '@ton/blueprint';
import { Address, beginCell, toNano } from '@ton/core';
import { prisma } from '../wrappers/prisma';
import { TransactionStatus, WithdrawalType } from '@prisma/client';

export async function run(provider: NetworkProvider) {
  const ownerWallet = process.env.OWNER_ADDRESS;
  const pendingWithdrawal = await prisma.withdrawal.findFirst({
    where: {
      status: TransactionStatus.PENDING,
      type: WithdrawalType.UNSTAKE,
    },
  });
  if (pendingWithdrawal === null) {
    throw new Error('Pending withdrawal not found');
  }
  await provider.sender().send({
    value: toNano('0.05'),
    // Owner wallet
    to: Address.parse(ownerWallet),
    sendMode: 1,
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
}
