//! Freenet lobby contract: shared waiting pool + mutual claims.
//!
//! State is `LobbyState` (CBOR). Deltas are also full or partial `LobbyState`
//! values that merge commutatively via `LobbyState::merge`.

use freenet_roulette_common::{verify_offer, LobbyState, LobbySummary};
use freenet_stdlib::prelude::*;

struct Contract;

fn decode_state(bytes: &[u8]) -> Result<LobbyState, ContractError> {
    if bytes.is_empty() {
        return Ok(LobbyState::default());
    }
    ciborium::de::from_reader(bytes).map_err(|e| ContractError::Deser(e.to_string()))
}

fn encode_state(state: &LobbyState) -> Result<Vec<u8>, ContractError> {
    let mut out = Vec::new();
    ciborium::ser::into_writer(state, &mut out).map_err(|e| ContractError::Deser(e.to_string()))?;
    Ok(out)
}

fn decode_summary(bytes: &[u8]) -> Result<LobbySummary, ContractError> {
    if bytes.is_empty() {
        return Ok(LobbySummary::default());
    }
    ciborium::de::from_reader(bytes).map_err(|e| ContractError::Deser(e.to_string()))
}

fn encode_summary(summary: &LobbySummary) -> Result<Vec<u8>, ContractError> {
    let mut out = Vec::new();
    ciborium::ser::into_writer(summary, &mut out)
        .map_err(|e| ContractError::Deser(e.to_string()))?;
    Ok(out)
}

fn validate_lobby(state: &LobbyState) -> Result<(), ContractError> {
    for offer in state.offers.values() {
        // Allow empty/bootstrap; require real sigs when present.
        let sig_nonzero = offer.sig.0.iter().any(|&b| b != 0);
        if sig_nonzero && !verify_offer(offer) {
            return Err(ContractError::InvalidState);
        }
        if sig_nonzero && offer.verifying_key.len() != 32 {
            return Err(ContractError::InvalidState);
        }
    }
    Ok(())
}

#[contract]
impl ContractInterface for Contract {
    fn validate_state(
        _parameters: Parameters<'static>,
        state: State<'static>,
        _related: RelatedContracts<'static>,
    ) -> Result<ValidateResult, ContractError> {
        let lobby = decode_state(state.as_ref())?;
        validate_lobby(&lobby)?;
        Ok(ValidateResult::Valid)
    }

    fn update_state(
        _parameters: Parameters<'static>,
        state: State<'static>,
        data: Vec<UpdateData<'static>>,
    ) -> Result<UpdateModification<'static>, ContractError> {
        let mut lobby = decode_state(state.as_ref())?;

        for update in data {
            match update {
                UpdateData::State(new_state) => {
                    let incoming = decode_state(new_state.as_ref())?;
                    validate_lobby(&incoming)?;
                    lobby = lobby.merge(&incoming).cleanup();
                }
                UpdateData::Delta(delta) => {
                    // Delta payload is also a LobbyState patch (partial ok).
                    let patch = decode_state(delta.as_ref())?;
                    validate_lobby(&patch)?;
                    lobby = lobby.merge(&patch).cleanup();
                }
                UpdateData::StateAndDelta { state: new_state, delta } => {
                    let incoming = decode_state(new_state.as_ref())?;
                    validate_lobby(&incoming)?;
                    lobby = lobby.merge(&incoming).cleanup();
                    let patch = decode_state(delta.as_ref())?;
                    validate_lobby(&patch)?;
                    lobby = lobby.merge(&patch).cleanup();
                }
                _ => {}
            }
        }

        validate_lobby(&lobby)?;
        let bytes = encode_state(&lobby)?;
        Ok(UpdateModification::valid(bytes.into()))
    }

    fn summarize_state(
        _parameters: Parameters<'static>,
        state: State<'static>,
    ) -> Result<StateSummary<'static>, ContractError> {
        let lobby = decode_state(state.as_ref())?;
        let summary = lobby.summarize();
        let bytes = encode_summary(&summary)?;
        Ok(StateSummary::from(bytes))
    }

    fn get_state_delta(
        _parameters: Parameters<'static>,
        state: State<'static>,
        summary: StateSummary<'static>,
    ) -> Result<StateDelta<'static>, ContractError> {
        let lobby = decode_state(state.as_ref())?;
        let summary = decode_summary(summary.as_ref())?;
        let delta = lobby.delta_from_summary(&summary);
        let bytes = encode_state(&delta)?;
        Ok(StateDelta::from(bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use freenet_roulette_common::{Identity, Preferences};

    #[test]
    fn merge_via_update_state() {
        let mut s = [0u8; 32];
        s[0] = 7;
        let id = Identity::from_seed(s);
        let offer = id.make_offer(1, 1000, Preferences::text_only(), [9u8; 32]);
        let mut patch = LobbyState::default();
        patch.upsert_offer(offer);

        let empty = encode_state(&LobbyState::default()).unwrap();
        let patch_bytes = encode_state(&patch).unwrap();

        let result = Contract::update_state(
            Parameters::from(vec![]),
            State::from(empty),
            vec![UpdateData::Delta(StateDelta::from(patch_bytes))],
        )
        .unwrap();
        let new_state = result.new_state.unwrap();
        let lobby = decode_state(new_state.as_ref()).unwrap();
        assert_eq!(lobby.offers.len(), 1);
    }
}
