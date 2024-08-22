// STRUCT
struct UserStake {
    lastDepositAt: Int;
    totalDeposit: Int;
}
message WithdrawJetton {
    amount: Int as uint64;
    to: Address;
}
message Unstake {
    amount: Int;
}
message Withdraw {
    amount: Int as uint64;
}
message ChangeYearlyPercent {
    newPercent: Int as uint32;
}
// EVENTS
message StakeEvent {
    address: Address;
    amount: Int;
}
message UnstakeEvent {
    address: Address;
    amount: Int;
}
message WithdrawEarned {
    amount: Int;
}
// CONSTANTS
// 31536000
const secondsPerYear: Int = 365 * 24 * 60 * 60;
// 1e9
const scaleFactor: Int = ton("1");

message(0xf8a7ea5) TokenTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    response_destination: Address;
    custom_payload: Cell?;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining; // Comment Text message when Transfer the jetton
}

message(0x178d4519) TokenTransferInternal {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    response_destination: Address?;
    forward_ton_amount: Int as coins;
    forward_payload: Slice as remaining; // Comment Text message when Transfer the jetton
}

message(0x7362d09c) TokenNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forward_payload: Slice as remaining; // Comment Text message when Transfer the jetton
}

message(0x595f07bc) TokenBurn {
    queryId: Int as uint64;
    amount: Int as coins;
    owner: Address;
    response_destination: Address;
}

message(0x7bdd97de) TokenBurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    owner: Address;
    response_destination: Address?;
}

message(0xd53276db) TokenExcesses {
    queryId: Int as uint64;
}

message TokenUpdateContent {
    content: Cell;
}
message SetContractJettonWallet {
    wallet: Address;
}