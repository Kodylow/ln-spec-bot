# BOLT #5: Recommendations for On-chain Transaction Handling

## Abstract

Lightning allows for two parties (a local node and a remote node) to conduct transactions
off-chain by giving each of the parties a *cross-signed commitment transaction*,
which describes the current state of the channel (basically, the current balance).
This *commitment transaction* is updated every time a new payment is made and
is spendable at all times.

There are three ways a channel can end:

1. The good way (*mutual close*): at some point the local and remote nodes agree
to close the channel. They generate a *closing transaction* (which is similar to a
commitment transaction, but without any pending payments) and publish it on the
blockchain (see [BOLT #2: Channel Close](02-peer-protocol.md#channel-close)).
2. The bad way (*unilateral close*): something goes wrong, possibly without evil
intent on either side. Perhaps one party crashed, for instance. One side
publishes its *latest commitment transaction*.
3. The ugly way (*revoked transaction close*): one of the parties deliberately
tries to cheat, by publishing an *outdated commitment transaction* (presumably,
a prior version, which is more in its favor).

Because Lightning is designed to be trustless, there is no risk of loss of funds
in any of these three cases; provided that the situation is properly handled.
The goal of this document is to explain exactly how a node should react when it
encounters any of the above situations, on-chain.

# Table of Contents
* [General Nomenclature](#general-nomenclature)
* [Commitment Transaction](#commitment-transaction)
* [Failing a Channel](#failing-a-channel)
* [Mutual Close Handling](#mutual-close-handling)
* [Unilateral Close Handling: Local Commitment Transaction](#unilateral-close-handling-local-commitment-transaction)
* [HTLC Output Handling: Local Commitment, Local Offers](#htlc-output-handling-local-commitment-local-offers)
* [HTLC Output Handling: Local Commitment, Remote Offers](#htlc-output-handling-local-commitment-remote-offers)
* [Unilateral Close Handling: Remote Commitment Transaction](#unilateral-close-handling-remote-commitment-transaction)
* [HTLC Output Handling: Remote Commitment, Local Offers](#htlc-output-handling-remote-commitment-local-offers)
* [HTLC Output Handling: Remote Commitment, Remote Offers](#htlc-output-handling-remote-commitment-remote-offers)
* [Revoked Transaction Close Handling](#revoked-transaction-close-handling)
* [Penalty Transactions Weight Calculation](#penalty-transactions-weight-calculation)
* [Generation of HTLC Transactions](#generation-of-htlc-transactions)
* [General Requirements](#general-requirements)
* [Appendix A: Expected Weights](#appendix-a-expected-weights)
* [Expected Weight of the `to_local` Penalty Transaction Witness](#expected-weight-of-the-to-local-penalty-transaction-witness)
* [Expected Weight of the `offered_htlc` Penalty Transaction Witness](#expected-weight-of-the-offered-htlc-penalty-transaction-witness)
* [Expected Weight of the `accepted_htlc` Penalty Transaction Witness](#expected-weight-of-the-accepted-htlc-penalty-transaction-witness)
* [Authors](#authors)

# General Nomenclature

Any unspent output is considered to be *unresolved* and can be *resolved*
as detailed in this document. Usually this is accomplished by spending it with
another *resolving* transaction. Although, sometimes simply noting the output
for later wallet spending is sufficient, in which case the transaction containing
the output is considered to be its own *resolving* transaction.

Outputs that are *resolved* are considered *irrevocably resolved*
once the remote's *resolving* transaction is included in a block at least 100
deep, on the most-work blockchain. 100 blocks is far greater than the
longest known Bitcoin fork and is the same wait time used for
confirmations of miners' rewards (see [Reference Implementation](https://github.com/bitcoin/bitcoin/blob/4db82b7aab4ad64717f742a7318e3dc6811b41be/src/consensus/tx_verify.cpp#L223)).

## Requirements

A node:
- once it has broadcast a funding transaction OR sent a commitment signature
for a commitment transaction that contains an HTLC output:
- until all outputs are *irrevocably resolved*:
- MUST monitor the blockchain for transactions that spend any output that
is NOT *irrevocably resolved*.
- MUST *resolve* all outputs, as specified below.
- MUST be prepared to resolve outputs multiple times, in case of blockchain
reorganizations.
- upon the funding transaction being spent, if the channel is NOT already
closed:
- MAY send a descriptive `error`.
- SHOULD fail the channel.
- SHOULD ignore invalid transactions.

## Rationale

Once a local node has some funds at stake, monitoring the blockchain is required
to ensure the remote node does not close unilaterally.

Invalid transactions (e.g. bad signatures) can be generated by anyone,
(and will be ignored by the blockchain anyway), so they should not
trigger any action.

# Commitment Transaction

The local and remote nodes each hold a *commitment transaction*. Each of these
commitment transactions has up to six types of outputs:

1. _local node's main output_: Zero or one output, to pay to the *local node's*
delayed_pubkey.
2. _remote node's main output_: Zero or one output, to pay to the *remote node's*
delayed_pubkey.
3. _local node's anchor output_: one output paying to the *local node's*
funding_pubkey.
4. _remote node's anchor output_: one output paying to the *remote node's*
funding_pubkey.
5. _local node's offered HTLCs_: Zero or more pending payments (*HTLCs*), to pay
the *remote node* in return for a payment preimage.
6. _remote node's offered HTLCs_: Zero or more pending payments (*HTLCs*), to
pay the *local node* in return for a payment preimage.

To incentivize the local and remote nodes to cooperate, an `OP_CHECKSEQUENCEVERIFY`
relative timeout encumbers the *local node's outputs* (in the *local node's
commitment transaction*) and the *remote node's outputs* (in the *remote node's
commitment transaction*). So for example, if the local node publishes its
commitment transaction, it will have to wait to claim its own funds,
whereas the remote node will have immediate access to its own funds. As a
consequence, the two commitment transactions are not identical, but they are
(usually) symmetrical.

See [BOLT #3: Commitment Transaction](03-transactions.md#commitment-transaction)
for more details.

# Failing a Channel

Although closing a channel can be accomplished in several ways, the most
efficient is preferred.

Various error cases involve closing a channel. The requirements for sending
error messages to peers are specified in
[BOLT #1: The `error` Message](01-messaging.md#the-error-message).

## Requirements

A node:
- if a *local commitment transaction* has NOT ever contained a `to_local`
or HTLC output:
- MAY simply forget the channel.
- otherwise:
- if the *current commitment transaction* does NOT contain `to_local` or
other HTLC outputs:
- MAY simply wait for the remote node to close the channel.
- until the remote node closes:
- MUST NOT forget the channel.
- otherwise:
- if it has received a valid `closing_signed` message that includes a
sufficient fee:
- SHOULD use this fee to perform a *mutual close*.
- otherwise:
- if the node knows or assumes its channel state is outdated:
- MUST NOT broadcast its *last commitment transaction*.
- otherwise:
- MUST broadcast the *last commitment transaction*, for which it has a
signature, to perform a *unilateral close*.
- MUST spend any `to_local_anchor` output, providing sufficient fees as incentive to include the commitment transaction in a block.
Special care must be taken when spending to a third-party, because this re-introduces the vulnerability that was
addressed by adding the CSV delay to the non-anchor outputs.
- SHOULD use [replace-by-fee](https://github.com/bitcoin/bips/blob/master/bip-0125.mediawiki) or other mechanism on the spending transaction if it proves insufficient for timely inclusion in a block.

## Rationale

Since `dust_limit_satoshis` is supposed to prevent creation of uneconomic
outputs (which would otherwise remain forever, unspent on the blockchain), all
commitment transaction outputs MUST be spent.

In the early stages of a channel, it's common for one side to have
little or no funds in the channel; in this case, having nothing at stake, a node
need not consume resources monitoring the channel state.

There exists a bias towards preferring mutual closes over unilateral closes,
because outputs of the former are unencumbered by a delay and are directly
spendable by wallets. In addition, mutual close fees tend to be less exaggerated
than those of commitment transactions (or in the case of `option_anchors`,
the commitment transaction may require a child transaction to cause it to be mined). So, the only reason not to use the
signature from `closing_signed` would be if the fee offered was too small for
it to be processed.

# Mutual Close Handling

A closing transaction *resolves* the funding transaction output.

In the case of a mutual close, a node need not do anything else, as it has
already agreed to the output, which is sent to its specified `scriptpubkey` (see
[BOLT #2: Closing initiation: `shutdown`](02-peer-protocol.md#closing-initiation-shutdown)).

# Unilateral Close Handling: Local Commitment Transaction

This is the first of two cases involving unilateral closes. In this case, a
node discovers its *local commitment transaction*, which *resolves* the funding
transaction output.

However, a node cannot claim funds from the outputs of a unilateral close that
it initiated, until the `OP_CHECKSEQUENCEVERIFY` delay has passed (as specified
by the remote node's `to_self_delay` field). Where relevant, this situation is
noted below.

## Requirements

A node:
- upon discovering its *local commitment transaction*:
- SHOULD spend the `to_local` output to a convenient address.
- MUST wait until the `OP_CHECKSEQUENCEVERIFY` delay has passed (as
specified by the remote node's `to_self_delay` field) before spending the
output.
- Note: if the output is spent (as recommended), the output is *resolved*
by the spending transaction, otherwise it is considered *resolved* by the
commitment transaction itself.
- MAY ignore the `to_remote` output.
- Note: No action is required by the local node, as `to_remote` is
considered *resolved* by the commitment transaction itself.
- MUST handle HTLCs offered by itself as specified in
[HTLC Output Handling: Local Commitment, Local Offers](#htlc-output-handling-local-commitment-local-offers).
- MUST handle HTLCs offered by the remote node as
specified in [HTLC Output Handling: Local Commitment, Remote Offers](#htlc-output-handling-local-commitment-remote-offers).

## Rationale

Spending the `to_local` output avoids having to remember the complicated
witness script, associated with that particular channel, for later
spending.

The `to_remote` output is entirely the business of the remote node, and
can be ignored.

## HTLC Output Handling: Local Commitment, Local Offers

Each HTLC output can only be spent by either the *local offerer*, by using the
HTLC-timeout transaction after it's timed out, or the *remote recipient*, if it
has the payment preimage.

There can be HTLCs which are not represented by any outputs: either
because they were trimmed as dust, or because the transaction has only been
partially committed.

The HTLC output has *timed out* once the height of the latest block is equal to
or greater than the HTLC `cltv_expiry`.

### Requirements

A node:
- if the commitment transaction HTLC output is spent using the payment
preimage, the output is considered *irrevocably resolved*:
- MUST extract the payment preimage from the transaction input witness.
- if the commitment transaction HTLC output has *timed out* and hasn't been
*resolved*:
- MUST *resolve* the output by spending it using the HTLC-timeout
transaction.
- once the resolving transaction has reached reasonable depth:
- MUST fail the corresponding incoming HTLC (if any).
- MUST resolve the output of that HTLC-timeout transaction.
- SHOULD resolve the HTLC-timeout transaction by spending it to a
convenient address.
- Note: if the output is spent (as recommended), the output is
*resolved* by the spending transaction, otherwise it is considered
*resolved* by the HTLC-timeout transaction itself.
- MUST wait until the `OP_CHECKSEQUENCEVERIFY` delay has passed (as
specified by the remote node's `open_channel` `to_self_delay` field)
before spending that HTLC-timeout output.
- for any committed HTLC that does NOT have an output in this commitment
transaction:
- once the commitment transaction has reached reasonable depth:
- MUST fail the corresponding incoming HTLC (if any).
- if no *valid* commitment transaction contains an output corresponding to
the HTLC.
- MAY fail the corresponding incoming HTLC sooner.

### Rationale

The payment preimage either serves to prove payment (when the offering node
originated the payment) or to redeem the corresponding incoming HTLC from
another peer (when the offering node is forwarding the payment). Once a node has
extracted the payment, it no longer cares about the fate of the HTLC-spending
transaction itself.

In cases where both resolutions are possible (e.g. when a node receives payment
success after timeout), either interpretation is acceptable; it is the
responsibility of the recipient to spend it before this occurs.

The local HTLC-timeout transaction needs to be used to time out the HTLC (to
prevent the remote node fulfilling it and claiming the funds) before the
local node can back-fail any corresponding incoming HTLC, using
`update_fail_htlc` (presumably with reason `permanent_channel_failure`), as
detailed in
[BOLT #2](02-peer-protocol.md#forwarding-htlcs).
If the incoming HTLC is also on-chain, a node must simply wait for it to
timeout: there is no way to signal early failure.

If an HTLC is too small to appear in *any commitment transaction*, it can be
safely failed immediately. Otherwise, if an HTLC isn't in the *local commitment
transaction*, a node needs to make sure that a blockchain reorganization, or
race, does not switch to a commitment transaction that does contain the HTLC
before the node fails it (hence the wait). The requirement that the incoming
HTLC be failed before its own timeout still applies as an upper bound.

## HTLC Output Handling: Local Commitment, Remote Offers

Each HTLC output can only be spent by the recipient, using the HTLC-success
transaction, which it can only populate if it has the payment
preimage. If it doesn't have the preimage (and doesn't discover it), it's
the offerer's responsibility to spend the HTLC output once it's timed out.

There are several possible cases for an offered HTLC:

1. The offerer is NOT irrevocably committed to it. The recipient will usually
not know the preimage, since it will not forward HTLCs until they're fully
committed. So using the preimage would reveal that this recipient is the
final hop; thus, in this case, it's best to allow the HTLC to time out.
2. The offerer is irrevocably committed to the offered HTLC, but the recipient
has not yet committed to an outgoing HTLC. In this case, the recipient can
either forward or timeout the offered HTLC.
3. The recipient has committed to an outgoing HTLC, in exchange for the offered
HTLC. In this case, the recipient must use the preimage, once it receives it
from the outgoing HTLC; otherwise, it will lose funds by sending an outgoing
payment without redeeming the incoming payment.

### Requirements

A local node:
- if it receives (or already possesses) a payment preimage for an unresolved
HTLC output that it has been offered AND for which it has committed to an
outgoing HTLC:
- MUST *resolve* the output by spending it, using the HTLC-success
transaction.
- MUST NOT reveal its own preimage when it's not the final recipient.<sup>[Preimage-Extraction](https://lists.linuxfoundation.org/pipermail/lightning-dev/2020-October/002857.html)</sup>
- MUST resolve the output of that HTLC-success transaction.
- otherwise:
- if the *remote node* is NOT irrevocably committed to the HTLC:
- MUST NOT *resolve* the output by spending it.
- SHOULD resolve that HTLC-success transaction output by spending it to a
convenient address.
- MUST wait until the `OP_CHECKSEQUENCEVERIFY` delay has passed (as specified
by the *remote node's* `open_channel`'s `to_self_delay` field), before
spending that HTLC-success transaction output.

If the output is spent (as is recommended), the output is *resolved* by
the spending transaction, otherwise it's considered *resolved* by the HTLC-success
transaction itself.

If it's NOT otherwise resolved, once the HTLC output has expired, it is
considered *irrevocably resolved*.

# Unilateral Close Handling: Remote Commitment Transaction

The *remote node's* commitment transaction *resolves* the funding
transaction output.

There are no delays constraining node behavior in this case, so it's simpler for
a node to handle than the case in which it discovers its local commitment
transaction (see [Unilateral Close Handling: Local Commitment Transaction](#unilateral-close-handling-local-commitment-transaction)).

## Requirements

A local node:
- upon discovering a *valid* commitment transaction broadcast by a
*remote node*:
- if possible:
- MUST handle each output as specified below.
- MAY take no action in regard to the associated `to_remote`, which is
simply a P2WPKH output to the *local node*.
- Note: `to_remote` is considered *resolved* by the commitment transaction
itself.
- MAY take no action in regard to the associated `to_local`, which is a
payment output to the *remote node*.
- Note: `to_local` is considered *resolved* by the commitment transaction
itself.
- MUST handle HTLCs offered by itself as specified in
[HTLC Output Handling: Remote Commitment, Local Offers](#htlc-output-handling-remote-commitment-local-offers)
- MUST handle HTLCs offered by the remote node as specified in
[HTLC Output Handling: Remote Commitment, Remote Offers](#htlc-output-handling-remote-commitment-remote-offers)
- otherwise (it is NOT able to handle the broadcast for some reason):
- MUST inform the user of potentially lost funds.

## Rationale

There may be more than one valid, *unrevoked* commitment transaction after a
signature has been received via `commitment_signed` and before the corresponding
`revoke_and_ack`. As such, either commitment may serve as the *remote node's*
commitment transaction; hence, the local node is required to handle both.

In the case of data loss, a local node may reach a state where it doesn't
recognize all of the *remote node's* commitment transaction HTLC outputs. It can
detect the data loss state, because it has signed the transaction, and the
commitment number is greater than expected. If both nodes support
`option_data_loss_protect`, the local node will possess the remote's
`per_commitment_point`, and thus can derive its own `remotepubkey` for the
transaction, in order to salvage its own funds. Note: in this scenario, the node
will be unable to salvage the HTLCs.

## HTLC Output Handling: Remote Commitment, Local Offers

Each HTLC output can only be spent by either the *local offerer*, after it's
timed out, or by the *remote recipient*, by using the HTLC-success transaction
if it has the payment preimage.

There can be HTLCs which are not represented by any outputs: either
because the outputs were trimmed as dust, or because the remote node has two
*valid* commitment transactions with differing HTLCs.

The HTLC output has *timed out* once the depth of the latest block is equal to
or greater than the HTLC `cltv_expiry`.

### Requirements

A local node:
- if the commitment transaction HTLC output is spent using the payment
preimage:
- MUST extract the payment preimage from the HTLC-success transaction input
witness.
- Note: the output is considered *irrevocably resolved*.
- if the commitment transaction HTLC output has *timed out* AND NOT been
*resolved*:
- MUST *resolve* the output, by spending it to a convenient address.
- for any committed HTLC that does NOT have an output in this commitment
transaction:
- once the commitment transaction has reached reasonable depth:
- MUST fail the corresponding incoming HTLC (if any).
- otherwise:
- if no *valid* commitment transaction contains an output corresponding to
the HTLC:
- MAY fail it sooner.

### Rationale

If the commitment transaction belongs to the *remote* node, the only way for it
to spend the HTLC output (using a payment preimage) is for it to use the
HTLC-success transaction.

The payment preimage either serves to prove payment (when the offering node is
the originator of the payment) or to redeem the corresponding incoming HTLC from
another peer (when the offering node is forwarding the payment). After a node has
extracted the payment, it no longer need be concerned with the fate of the
HTLC-spending transaction itself.

In cases where both resolutions are possible (e.g. when a node receives payment
success after timeout), either interpretation is acceptable: it's the
responsibility of the recipient to spend it before this occurs.

Once it has timed out, the local node needs to spend the HTLC output (to prevent
the remote node from using the HTLC-success transaction) before it can
back-fail any corresponding incoming HTLC, using `update_fail_htlc`
(presumably with reason `permanent_channel_failure`), as detailed in
[BOLT #2](02-peer-protocol.md#forwarding-htlcs).
If the incoming HTLC is also on-chain, a node simply waits for it to
timeout, as there's no way to signal early failure.

If an HTLC is too small to appear in *any commitment transaction*, it
can be safely failed immediately. Otherwise,
if an HTLC isn't in the *local commitment transaction* a node needs to make sure
that a blockchain reorganization or race does not switch to a
commitment transaction that does contain it before the node fails it: hence
the wait. The requirement that the incoming HTLC be failed before its
own timeout still applies as an upper bound.

## HTLC Output Handling: Remote Commitment, Remote Offers

The remote HTLC outputs can only be spent by the local node if it has the
payment preimage. If the local node does not have the preimage (and doesn't
discover it), it's the remote node's responsibility to spend the HTLC output
once it's timed out.

There are actually several possible cases for an offered HTLC:

1. The offerer is not irrevocably committed to it. In this case, the recipient
usually won't know the preimage, since it won't forward HTLCs until
they're fully committed. As using the preimage would reveal that
this recipient is the final hop, it's best to allow the HTLC to time out.
2. The offerer is irrevocably committed to the offered HTLC, but the recipient
hasn't yet committed to an outgoing HTLC. In this case, the recipient can
either forward it or wait for it to timeout.
3. The recipient has committed to an outgoing HTLC in exchange for an offered
HTLC. In this case, the recipient must use the preimage, if it receives it
from the outgoing HTLC; otherwise, it will lose funds by sending an outgoing
payment without redeeming the incoming one.

### Requirements

A local node:
- if it receives (or already possesses) a payment preimage for an unresolved
HTLC output that it was offered AND for which it has committed to an
outgoing HTLC:
- MUST *resolve* the output by spending it to a convenient address.
- otherwise:
- if the remote node is NOT irrevocably committed to the HTLC:
- MUST NOT *resolve* the output by spending it.

If not otherwise resolved, once the HTLC output has expired, it is considered
*irrevocably resolved*.

# Revoked Transaction Close Handling

If any node tries to cheat by broadcasting an outdated commitment transaction
(any previous commitment transaction besides the most current one), the other
node in the channel can use its revocation private key to claim all the funds from the
channel's original funding transaction.

## Requirements

Once a node discovers a commitment transaction for which *it* has a
revocation private key, the funding transaction output is *resolved*.

A local node:
- MUST NOT broadcast a commitment transaction for which *it* has exposed the
`per_commitment_secret`.
- MAY take no action regarding the _local node's main output_, as this is a
simple P2WPKH output to itself.
- Note: this output is considered *resolved* by the commitment transaction
itself.
- MUST *resolve* the _remote node's main output_ by spending it using the
revocation private key.
- MUST *resolve* the _remote node's offered HTLCs_ in one of three ways:
* spend the *commitment tx* using the payment revocation private key.
* spend the *commitment tx* using the payment preimage (if known).
* spend the *HTLC-timeout tx*, if the remote node has published it.
- MUST *resolve* the _local node's offered HTLCs_ in one of three ways:
* spend the *commitment tx* using the payment revocation private key.
* spend the *commitment tx* once the HTLC timeout has passed.
* spend the *HTLC-success tx*, if the remote node has published it.
- MUST *resolve* the _remote node's HTLC-timeout transaction_ by spending it
using the revocation private key.
- MUST *resolve* the _remote node's HTLC-success transaction_ by spending it
using the revocation private key.
- SHOULD extract the payment preimage from the transaction input witness, if
it's not already known.
- if `option_anchors` applies:
- MAY use a single transaction to *resolve* all the outputs.
- if confirmation doesn't happen before reaching `security_delay` blocks from
expiry:
- SHOULD *resolve* revoked outputs in their own, separate penalty transactions. A previous
penalty transaction claiming multiple revoked outputs at once may be blocked from confirming
because of a transaction pinning attack.
- otherwise:
- MAY use a single transaction to *resolve* all the outputs.
- MUST handle its transactions being invalidated by HTLC transactions.

## Rationale

A single transaction that resolves all the outputs will be under the
standard size limit because of the 483 HTLC-per-party limit (see
[BOLT #2](02-peer-protocol.md#the-open_channel-message)).

Note: if `option_anchors` applies, the cheating node can pin spends of its
HTLC-timeout/HTLC-success outputs thanks to SIGHASH_SINGLE malleability.
Using a single penalty transaction for all revoked outputs is thus unsafe as it
could be blocked to propagate long enough for the _local node's `to_local` output_ 's
relative locktime to expire and the cheating party escaping the penalty on this
output. Though this situation doesn't prevent faithful punishment of the second-level
revoked output if the pinning transaction confirms.

The `security_delay` is a fixed-point relative to the absolute expiration of
the revoked output at which the punishing node must broadcast a single-spend
transaction for the revoked output and actively fee-bump it until its confirmation.
The exact value of `security_delay` is left as a matter of node policy, though we
recommend 18 blocks (similar to incoming HTLC deadline).

## Penalty Transactions Weight Calculation

There are three different scripts for penalty transactions, with the following
witness weights (details of weight computation are in
[Appendix A](#appendix-a-expected-weights)):

to_local_penalty_witness: 160 bytes
offered_htlc_penalty_witness: 243 bytes
accepted_htlc_penalty_witness: 249 bytes

The penalty *txinput* itself takes up 41 bytes and has a weight of 164 bytes,
which results in the following weights for each input:

to_local_penalty_input_weight: 324 bytes
offered_htlc_penalty_input_weight: 407 bytes
accepted_htlc_penalty_input_weight: 413 bytes

The rest of the penalty transaction takes up 4+1+1+8+1+34+4=53 bytes of
non-witness data: assuming it has a pay-to-witness-script-hash (the largest
standard output script), in addition to a 2-byte witness header.

In addition to spending these outputs, a penalty transaction may optionally
spend the commitment transaction's `to_remote` output (e.g. to reduce the total
amount paid in fees). Doing so requires the inclusion of a P2WPKH witness and an
additional *txinput*, resulting in an additional 108 + 164 = 272 bytes.

In the worst case scenario, the node holds only incoming HTLCs, and the
HTLC-timeout transactions are not published, which forces the node to spend from
the commitment transaction.

With a maximum standard weight of 400000 bytes, the maximum number of HTLCs that
can be swept in a single transaction is as follows:

max_num_htlcs = (400000 - 324 - 272 - (4 * 53) - 2) / 413 = 966

Thus, 483 bidirectional HTLCs (containing both `to_local` and
`to_remote` outputs) can be resolved in a single penalty transaction.
Note: even if the `to_remote` output is not swept, the resulting
`max_num_htlcs` is 967; which yields the same unidirectional limit of 483 HTLCs.

# Generation of HTLC Transactions

If `option_anchors` does not apply to the commitment transaction, then
HTLC-timeout and HTLC-success transactions are complete transactions with
(hopefully!) reasonable fees and must be used directly.

Otherwise, `SIGHASH_SINGLE|SIGHASH_ANYONECANPAY` MUST be used on the
HTLC signatures received from the peer, as this allows HTLC transactions to be combined with 
other transactions.  The local signature MUST use `SIGHASH_ALL`, otherwise
anyone can attach additional inputs and outputs to the tx.

If `option_anchors_zero_fee_htlc_tx` applies, then the HTLC-timeout and
HTLC-success transactions are signed with the input and output having the same
value. This means they have a zero fee and MUST be combined with other inputs
to arrive at a reasonable fee.

## Requirements

A node which broadcasts an HTLC-success or HTLC-timeout transaction for a
commitment transaction:
1. if `option_anchor_outputs` applies:
- SHOULD combine it with inputs contributing sufficient fee to ensure
timely inclusion in a block.
- MAY combine it with other transactions.
2. if `option_anchors_zero_fee_htlc_tx` applies:
- MUST combine it with inputs contributing sufficient fee to ensure timely
inclusion in a block.
- MAY combine it with other transactions.

Note that `option_anchors_zero_fee_htlc_tx` has a stronger requirement for
adding inputs to the final transactions than `option_anchor_outputs`, since the
HTLC-success and HTLC-timeout transactions won't propagate without additional
inputs added.

# General Requirements

A node:
- upon discovering a transaction that spends a funding transaction output
which does not fall into one of the above categories (mutual close, unilateral
close, or revoked transaction close):
- MUST warn the user of potentially lost funds.
- Note: the existence of such a rogue transaction implies that its private
key has leaked and that its funds may be lost as a result.
- MAY simply monitor the contents of the most-work chain for transactions.
- Note: on-chain HTLCs should be sufficiently rare that speed need not be
considered critical.
- MAY monitor (valid) broadcast transactions (a.k.a the mempool).
- Note: watching for mempool transactions should result in lower latency
HTLC redemptions.

# Appendix A: Expected Weights

## Expected Weight of the `to_local` Penalty Transaction Witness

As described in [BOLT #3](03-transactions.md), the witness for this transaction
is:

<sig> 1 { OP_IF <revocationpubkey> OP_ELSE to_self_delay OP_CSV OP_DROP <local_delayedpubkey> OP_ENDIF OP_CHECKSIG }

The *expected weight* of the `to_local` penalty transaction witness is
calculated as follows:

to_local_script: 83 bytes
- OP_IF: 1 byte
- OP_DATA: 1 byte (revocationpubkey length)
- revocationpubkey: 33 bytes
- OP_ELSE: 1 byte
- OP_DATA: 1 byte (delay length)
- delay: 8 bytes
- OP_CHECKSEQUENCEVERIFY: 1 byte
- OP_DROP: 1 byte
- OP_DATA: 1 byte (local_delayedpubkey length)
- local_delayedpubkey: 33 bytes
- OP_ENDIF: 1 byte
- OP_CHECKSIG: 1 byte

to_local_penalty_witness: 160 bytes
- number_of_witness_elements: 1 byte
- revocation_sig_length: 1 byte
- revocation_sig: 73 bytes
- one_length: 1 byte
- witness_script_length: 1 byte
- witness_script (to_local_script)

## Expected Weight of the `offered_htlc` Penalty Transaction Witness

The *expected weight* of the `offered_htlc` penalty transaction witness is
calculated as follows (some calculations have already been made in
[BOLT #3](03-transactions.md)):

offered_htlc_script: 133 bytes

offered_htlc_penalty_witness: 243 bytes
- number_of_witness_elements: 1 byte
- revocation_sig_length: 1 byte
- revocation_sig: 73 bytes
- revocation_key_length: 1 byte
- revocation_key: 33 bytes
- witness_script_length: 1 byte
- witness_script (offered_htlc_script)

## Expected Weight of the `accepted_htlc` Penalty Transaction Witness

The *expected weight*  of the `accepted_htlc` penalty transaction witness is
calculated as follows (some calculations have already been made in
[BOLT #3](03-transactions.md)):

accepted_htlc_script: 139 bytes

accepted_htlc_penalty_witness: 249 bytes
- number_of_witness_elements: 1 byte
- revocation_sig_length: 1 byte
- revocation_sig: 73 bytes
- revocationpubkey_length: 1 byte
- revocationpubkey: 33 bytes
- witness_script_length: 1 byte
- witness_script (accepted_htlc_script)

# Authors

[FIXME:]

![Creative Commons License](https://i.creativecommons.org/l/by/4.0/88x31.png "License CC-BY")
<br>
This work is licensed under a [Creative Commons Attribution 4.0 International License](http://creativecommons.org/licenses/by/4.0/).