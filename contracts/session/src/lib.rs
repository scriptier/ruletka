//! Freenet session contract: ephemeral 1:1 text (and later WebRTC signaling).
//!
//! Parameters (CBOR): `SessionParams { peer_a, peer_b, session_id }` — only those
//! peers may contribute messages. State merges as a message CRDT.

use freenet_roulette_common::{SessionParams, SessionState};
use freenet_stdlib::prelude::*;

// Re-export for contract consumers.
pub use freenet_roulette_common::SessionParams as Params;

struct Contract;

fn decode_params(bytes: &[u8]) -> Result<SessionParams, ContractError> {
    ciborium::de::from_reader(bytes).map_err(|e| ContractError::Deser(e.to_string()))
}

fn decode_state(bytes: &[u8]) -> Result<SessionState, ContractError> {
    if bytes.is_empty() {
        return Ok(SessionState {
            max_messages: 100,
            ..Default::default()
        });
    }
    ciborium::de::from_reader(bytes).map_err(|e| ContractError::Deser(e.to_string()))
}

fn encode_state(state: &SessionState) -> Result<Vec<u8>, ContractError> {
    let mut out = Vec::new();
    ciborium::ser::into_writer(state, &mut out).map_err(|e| ContractError::Deser(e.to_string()))?;
    Ok(out)
}

fn validate(params: &SessionParams, state: &SessionState) -> Result<(), ContractError> {
    if let Some(meta) = &state.meta {
        if meta.session_id != params.session_id {
            return Err(ContractError::InvalidState);
        }
        if meta.peer_a != params.peer_a || meta.peer_b != params.peer_b {
            // Allow swapped ordering only if sorted form matches.
            let (a, b) = if params.peer_a <= params.peer_b {
                (params.peer_a, params.peer_b)
            } else {
                (params.peer_b, params.peer_a)
            };
            if meta.peer_a != a || meta.peer_b != b {
                return Err(ContractError::InvalidState);
            }
        }
    }
    for m in &state.messages {
        if !params.allows(m.author) {
            return Err(ContractError::InvalidState);
        }
    }
    for s in &state.signals {
        if !params.allows(s.author) {
            return Err(ContractError::InvalidState);
        }
    }
    Ok(())
}

#[contract]
impl ContractInterface for Contract {
    fn validate_state(
        parameters: Parameters<'static>,
        state: State<'static>,
        _related: RelatedContracts<'static>,
    ) -> Result<ValidateResult, ContractError> {
        if parameters.as_ref().is_empty() {
            // Allow empty params only for empty bootstrap state.
            let st = decode_state(state.as_ref())?;
            if st.messages.is_empty() {
                return Ok(ValidateResult::Valid);
            }
            return Err(ContractError::InvalidState);
        }
        let params = decode_params(parameters.as_ref())?;
        let st = decode_state(state.as_ref())?;
        validate(&params, &st)?;
        Ok(ValidateResult::Valid)
    }

    fn update_state(
        parameters: Parameters<'static>,
        state: State<'static>,
        data: Vec<UpdateData<'static>>,
    ) -> Result<UpdateModification<'static>, ContractError> {
        let params = if parameters.as_ref().is_empty() {
            None
        } else {
            Some(decode_params(parameters.as_ref())?)
        };
        let mut st = decode_state(state.as_ref())?;

        for update in data {
            match update {
                UpdateData::State(new_state) => {
                    let incoming = decode_state(new_state.as_ref())?;
                    if let Some(ref p) = params {
                        validate(p, &incoming)?;
                    }
                    st = st.merge(&incoming);
                }
                UpdateData::Delta(delta) => {
                    let incoming = decode_state(delta.as_ref())?;
                    if let Some(ref p) = params {
                        validate(p, &incoming)?;
                    }
                    st = st.merge(&incoming);
                }
                UpdateData::StateAndDelta { state: new_state, delta } => {
                    let incoming = decode_state(new_state.as_ref())?;
                    if let Some(ref p) = params {
                        validate(p, &incoming)?;
                    }
                    st = st.merge(&incoming);
                    let patch = decode_state(delta.as_ref())?;
                    if let Some(ref p) = params {
                        validate(p, &patch)?;
                    }
                    st = st.merge(&patch);
                }
                _ => {}
            }
        }

        if let Some(ref p) = params {
            validate(p, &st)?;
        }
        let bytes = encode_state(&st)?;
        Ok(UpdateModification::valid(bytes.into()))
    }

    fn summarize_state(
        _parameters: Parameters<'static>,
        state: State<'static>,
    ) -> Result<StateSummary<'static>, ContractError> {
        let st = decode_state(state.as_ref())?;
        // Compact summary: message count + signal count.
        let summary = (st.messages.len() as u64, st.signals.len() as u64);
        let mut out = Vec::new();
        ciborium::ser::into_writer(&summary, &mut out)
            .map_err(|e| ContractError::Deser(e.to_string()))?;
        Ok(StateSummary::from(out))
    }

    fn get_state_delta(
        _parameters: Parameters<'static>,
        state: State<'static>,
        _summary: StateSummary<'static>,
    ) -> Result<StateDelta<'static>, ContractError> {
        // MVP: send full state as delta.
        Ok(StateDelta::from(state.as_ref().to_vec()))
    }
}
