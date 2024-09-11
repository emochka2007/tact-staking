import "@stdlib/deploy";
import "@stdlib/ownable";
import "./messages";
contract Staking with Deployable, Ownable {
    // store here user staked coins
    userEarned: map<Address, Int>;
    // Total Supply of stake
    totalSupply: Int;
    // Balance of deposited tokens by each user
    balanceOf: map<Address, UserStake>;
    // Claimed for each user
    claimedFromStake: map<Address, Int>;
    //deployer
    owner: Address;
    // Year percent
    yearlyPercent: Int;
    contractJettonWallet: Address?;

    init() {
        self.owner = sender();
        // Using scale factor to handle decimals
        // Percent * 100 / 1e9 / 10000
        self.yearlyPercent = 1800 * scaleFactor;
        self.totalSupply = 0;
    }

    // --PRIVATE--
    // Helper function for calculation
    fun calcAllStake():Int{
        let totalDeposit:Int = 0;
        foreach (key, value in self.balanceOf) {
            totalDeposit += value.totalDeposit;
        }
        return totalDeposit;
    }

    // Updating each stake deposit (used after changin the yearly percent)
    fun updateAllDepositAt(){
        foreach (key, value in self.balanceOf) {
            self.updateUserRewards(key);
            self.updateLastDepositDate(key, now());
        }
    }

    // Updating claimed after unstake or withdrawAll
    fun updateClaimed(user: Address, amount: Int){
        let claimed: Int? = self.claimedFromStake.get(user);
        if(claimed == null){
            self.claimedFromStake.set(user, amount);
        } else {
            let userClaimed = claimed!!;
            self.claimedFromStake.set(user, amount + userClaimed);
        }
    }
    // Helper function to decrease stake
    fun decreaseUserStake(user: Address, amount: Int){
        require(self.balanceOf.get(user) != null, "User not found");
        let userStake: UserStake = self.balanceOf.get(user)!!;
        require(userStake.totalDeposit>= amount, "Amount is above the staked value");
        let newUserStake = UserStake{
        totalDeposit: userStake.totalDeposit - amount, lastDepositAt: now()};
        self.balanceOf.set(user, newUserStake);
    }

    // Empty the stake balance of user
    fun withdrawAllUserStake(user: Address){
        require(self.balanceOf.get(user) != null, "User not found");
        let userStake: UserStake = self.balanceOf.get(user)!!;
        let newUserStake = UserStake{
        totalDeposit: 0, lastDepositAt: now()};
        self.balanceOf.set(user, newUserStake);
    }
    // Helper function to update last deposit of user
    fun updateLastDepositDate(user: Address, date: Int){
        require(self.balanceOf.get(user) != null, "User not found");
        let userStake: UserStake = self.balanceOf.get(user)!!;
        let newUserStake = UserStake{
        totalDeposit: userStake.totalDeposit, lastDepositAt: date};
        self.balanceOf.set(user, newUserStake);
    }
    // Helper function to increase user stake
    fun increaseUserStake(user: Address, amount: Int){
        require(self.balanceOf.get(user) != null, "User not found");
        let userStake: UserStake = self.balanceOf.get(user)!!;
        let newUserStake = UserStake{
        totalDeposit: userStake.totalDeposit + amount, lastDepositAt: now()};
        self.balanceOf.set(user, newUserStake);
    }
    // Main calculation func to get the current rewards of the user
    fun calcEarned(address: Address): Int {
        let getUser: UserStake? = self.balanceOf.get(address);
        require(getUser!= null, "User not found when calculating rewards");
        let existUser = getUser!!;
        let earned = self.userEarned.get(address);
        if(earned == null){
            earned = 0;
        }
        let existRewards:Int = earned!!;
        let stakingDuration = now() - existUser.lastDepositAt;
        if(stakingDuration > secondsPerYear){
            stakingDuration = secondsPerYear;
        }
        return existUser.totalDeposit * self.yearlyPercent / 10000  * stakingDuration / secondsPerYear + existRewards;
    }
    // Func is used to update user rewards inside mapping
    fun updateUserRewards(user: Address){
        let earned = self.calcEarned(user);
        self.userEarned.set(user, earned);
    }
    // --RECEIVE_INTERNAL--
    receive(msg: SetContractJettonWallet){
        require(sender() == self.owner, "Only owner is allowed to set contractJettonWallet");
        self.contractJettonWallet = msg.wallet;
        self.reply("Refund gas excess".asComment());
    }
    // Stake func, updates balance and recalculates rewards
    receive(msg: TokenNotification){
        require(msg.amount > 0, "Amount must be above zero");
        require(self.contractJettonWallet != null, "Jetton address must be sent");
        require(context().sender == self.contractJettonWallet, "Not from the jetton wallet");
        let userStaked: UserStake? = self.balanceOf.get(msg.sender);
        if(userStaked == null){
            self.balanceOf.set(msg.sender, UserStake{
            totalDeposit: msg.amount, lastDepositAt: now()});
            self.updateUserRewards(msg.sender);
        } else {
            self.updateUserRewards(msg.sender);
            self.increaseUserStake(msg.sender, msg.amount);
        }
        self.totalSupply += msg.amount;
        emit(StakeEvent{
        address: msg.sender, amount: msg.amount}.toCell());
    }
    // Only withdraw deposit
//    receive(msg: Unstake) {
//        require(msg.amount > 0, "Amount must be above zero");
//        require(self.contractJettonWallet != null, "Jetton address must be sent");
//        let sender: Address = sender();
//        self.updateUserRewards(sender);
//        self.decreaseUserStake(sender, msg.amount);
//        self.updateClaimed(sender, msg.amount);
//        self.totalSupply -= msg.amount;
//        send(SendParameters{
//        to: self.contractJettonWallet!!,
//        value: ton("0.000001"),
//        mode: (SendRemainingValue + SendIgnoreErrors),
//        bounce: false, // 0x7362d09c - notify new owner
//        body: TokenTransfer{
//        queryId: now(),
//        amount: msg.amount,
//        destination: context().sender,
//        response_destination: myAddress(),
//        custom_payload: null,
//        forward_ton_amount: ton("0.0000001"),
//        //working on tests
//        forward_payload: beginCell().storeUint(0,1).endCell().asSlice()
//        }.toCell()
//        }
//        );
//        emit(UnstakeEvent{
//        address: sender, amount: msg.amount}.toCell());
//        self.reply("Refund gas excess".asComment());
//    }
//    // Only withdraw rewards
//    receive(msg: WithdrawEarned){
//        require(msg.amount > 0, "Amount must be above zero");
//        require(self.contractJettonWallet != null, "Jetton address must be sent");
//        let sender: Address= sender();
//        require(self.userEarned.get(sender) != null, "User not found");
//        let earned: Int = self.calcEarned(sender);
//        let scaledMsgAmount = msg.amount * scaleFactor;
//        require(earned >= scaledMsgAmount, "Amount is above the earned value");
//        self.userEarned.set(sender, earned - scaledMsgAmount);
//        self.updateLastDepositDate(sender, now());
//        send(
//        SendParameters{
//        to: self.contractJettonWallet!!,
//        value: ton("0.000001"),
//        mode: (SendRemainingValue + SendIgnoreErrors),
//        bounce: false, // 0x7362d09c - notify new owner
//        body: TokenTransfer{
//        queryId: now(),
//        amount: msg.amount,
//        destination: context().sender,
//        response_destination: myAddress(),
//        custom_payload: null,
//        forward_ton_amount: ton("0.000001"),
//        forward_payload: beginCell().storeUint(0,1).endCell().asSlice()
//        }
//        .toCell()
//        }
//        );
//    }
    // Withdraw rewards + deposit
    receive(msg: WithdrawAll) {
        let sender: Address= sender();
        require(self.userEarned.get(sender) != null, "User not found");
        require(self.balanceOf.get(sender) != null, "User not found");
        let earned: Int = self.calcEarned(sender);
        let deposited: UserStake = self.balanceOf.get(sender)!!;
        let totalAmount: Int = self.calcEarned(sender) / scaleFactor + deposited.totalDeposit;
        self.userEarned.set(sender, 0);
        self.withdrawAllUserStake(sender);
        self.updateLastDepositDate(sender, now());
        send(
        SendParameters{
        to: self.contractJettonWallet!!,
        value: ton("0.000001"),
        mode: (SendRemainingValue + SendIgnoreErrors),
        bounce: false, // 0x7362d09c - notify new owner
        body: TokenTransfer{
        queryId: now(),
        amount: totalAmount,
        destination: context().sender,
        response_destination: myAddress(),
        custom_payload: null,
        forward_ton_amount: ton("0.000001"),
        forward_payload: beginCell().storeUint(0,1).endCell().asSlice()
        }
        .toCell()
        }
        );
    }
    receive(msg: ChangeYearlyPercent){
        require(sender() == self.owner, "Only owner is allowed to call ChangeYearlyPercent");
        require(msg.newPercent > 0, "New yearly percent must be above zero");
        // We are updating all of the last deposits earned and store them inside earned map before updating the percent
        self.updateAllDepositAt();
        // Handle float values here (newPercent = 1850) for exampe
        self.yearlyPercent = msg.newPercent * scaleFactor;
        self.reply("Refund gas excess".asComment());
    }
    //Withraw ton from contract
    receive(msg: Withdraw) {
        require(sender() == self.owner, "Only owner is allowed to withdraw");
        require(self.balance() >= msg.amount, "Balance is less than msg.amount");
        send(SendParameters{
        to: self.owner,
        bounce: true,
        value: msg.amount - context().value,
        mode: SendRemainingValue + SendIgnoreErrors
        });
    }
    // Withdraw staked jetton from contract
    receive(msg: WithdrawJetton){
        require(sender() == self.owner, "Only owner is allowed to withdraw jetton");
        send(SendParameters{
            to: self.contractJettonWallet!!,
            value: ton("0.000001"),
            mode: (SendRemainingValue + SendIgnoreErrors),
            bounce: false, // 0x7362d09c - notify new owner
            body: TokenTransfer{
            queryId: now(),
            amount: msg.amount,
            destination: msg.to,
            response_destination: myAddress(),
            custom_payload: null,
            forward_ton_amount: ton("0.0000001"),
            forward_payload: beginCell().storeUint(0,1).endCell().asSlice()
        }.toCell()
        }
        );
    }
    // Receive funds
    receive(){}
    // --GETTERS--
    get fun totalStake(): Int {
        return self.calcAllStake();
    }
    get fun earnedOfAddress(user: Address): Int {
        return self.calcEarned(user) / scaleFactor;
    }
    get fun balanceOfAddress(user: Address): UserStake? {
        return self.balanceOf.get(user);
    }
    get fun balances(): map<Address, UserStake> {
        return self.balanceOf;
    }
    get fun earned(): map<Address, Int> {
        return self.userEarned;
    }
    get fun claimedByAddress(user: Address): Int? {
        return self.claimedFromStake.get(user);
    }
    get fun totalSupply(): Int {
        return self.totalSupply;
    }
    // Get balance
    get fun balance(): Int {
        return myBalance();
    }
    get fun jettonWallet(): Address? {
        return self.contractJettonWallet;
    }
    get fun yearlyPercent(): Int {
        return self.yearlyPercent / scaleFactor;
    }
}
