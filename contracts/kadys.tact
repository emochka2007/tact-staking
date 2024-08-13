import "@stdlib/deploy";
import "@stdlib/ownable";
import "./messages";
contract Kadys with Deployable, Ownable {
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

    //TODO after update percent update every key in map
    init() {
        // deployer = owner
        self.owner = sender();
        // Using scale factor to handle decimals
        self.yearlyPercent = 18 * scaleFactor / 100;
        self.totalSupply = 0;
    }

    // --PRIVATE--
    // Func is used to calculate rewards by user
    fun decreaseUserStake(user: Address, amount: Int){
        require(self.balanceOf.get(user) != null, "User not found");
        let userStake: UserStake = self.balanceOf.get(user)!!;
        require(userStake.totalDeposit>= amount, "Amount is above the staked value");
        let newUserStake = UserStake{
        totalDeposit: userStake.totalDeposit - amount, lastDepositAt: now()};
        self.balanceOf.set(user, newUserStake);
    }
    fun updateLastDepositDate(user: Address, date: Int){
        require(sender() == self.owner, "Only owner is allowed to withdraw");
        require(self.balanceOf.get(user) != null, "User not found");
        let userStake: UserStake = self.balanceOf.get(user)!!;
        let newUserStake = UserStake{
        totalDeposit: userStake.totalDeposit, lastDepositAt: date};
        self.balanceOf.set(user, newUserStake);
    }
    fun increaseUserStake(user: Address, amount: Int){
        require(self.balanceOf.get(user) != null, "User not found");
        let userStake: UserStake = self.balanceOf.get(user)!!;
        let newUserStake = UserStake{
        totalDeposit: userStake.totalDeposit + amount, lastDepositAt: now()};
        self.balanceOf.set(user, newUserStake);
    }
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
        return existUser.totalDeposit * self.yearlyPercent * stakingDuration / secondsPerYear + existRewards;
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
        dump(msg.amount);
        dump(msg.queryId);
        //TODO tests
        require(context().sender == self.contractJettonWallet, "Not from the jetton wallet");
        let userStaked: UserStake? = self.balanceOf.get(msg.sender);
        if(userStaked == null){
            dump("userstake null");
            self.balanceOf.set(msg.sender, UserStake{
            totalDeposit: msg.amount, lastDepositAt: now()});
            self.updateUserRewards(msg.sender);
        } else {
            let currentStake= userStaked!!;
            dump(currentStake.totalDeposit);
            self.updateUserRewards(msg.sender);
            self.increaseUserStake(msg.sender, msg.amount);
        }
        self.totalSupply += msg.amount;
        emit(StakeEvent{
        address: msg.sender, amount: msg.amount}.toCell());
    }
    receive(msg: Unstake) {
        require(msg.amount > 0, "Amount must be above zero");
        require(self.contractJettonWallet != null, "Jetton address must be sent");
        let sender: Address = sender();
        self.updateUserRewards(sender);
        self.decreaseUserStake(sender, msg.amount);
        self.updateClaimed(sender, msg.amount);
        self.totalSupply -= msg.amount;
        send(SendParameters{
        to: self.contractJettonWallet!!,
        value: 0,
        mode: (SendRemainingValue + SendIgnoreErrors),
        bounce: false, // 0x7362d09c - notify new owner
        body: TokenTransfer{
        queryId: now(),
        amount: msg.amount,
        destination: context().sender,
        response_destination: myAddress(),
        custom_payload: null,
        forward_ton_amount: ton("0.01"),
        forward_payload: beginCell().storeInt(0, 64).asSlice(),
        }.toCell()
        }
        );
        emit(UnstakeEvent{
        address: sender, amount: msg.amount}.toCell());
    }
    receive(msg: WithdrawEarned){
        require(msg.amount > 0, "Amount must be above zero");
        let sender: Address= sender();
        require(self.userEarned.get(sender) != null, "User not found");
        let earned: Int = self.calcEarned(sender);
        let scaledMsgAmount = msg.amount * scaleFactor;
        require(earned >= scaledMsgAmount, "Amount is above the earned value");
        self.userEarned.set(sender, earned - scaledMsgAmount);
        self.updateLastDepositDate(sender, now());
        send(SendParameters{
        to: self.contractJettonWallet!!,
        value: 0,
        mode: (SendRemainingValue + SendIgnoreErrors),
        bounce: false, // 0x7362d09c - notify new owner
        body: TokenTransfer{
        queryId: now(),
        amount: msg.amount,
        destination: context().sender,
        response_destination: myAddress(),
        custom_payload: null,
        forward_ton_amount: 0,
        forward_payload: emptySlice()
        }.toCell()
        }
        );
        self.reply("Refund gas excess".asComment());
    }
    fun updateClaimed(user: Address, amount: Int){
        let claimed: Int? = self.claimedFromStake.get(user);
        if(claimed == null){
            self.claimedFromStake.set(user, amount);
        } else {
            let userClaimed = claimed!!;
            self.claimedFromStake.set(user, amount + userClaimed);
        }
    }
    receive(msg: ChangeYearlyPercent){
        require(sender() == self.owner, "Only owner is allowed to call ChangeYearlyPercent");
        require(msg.newPercent > 0, "New yearly percent must be above zero");
        self.yearlyPercent = msg.newPercent;
        self.reply("Refund gas excess".asComment());
        require(sender() == self.owner, "Only owner is allowed to calcEarned");
    }
    //Withraw
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
    // Receive funds
    receive(){}
    // --GETTERS--
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
}
