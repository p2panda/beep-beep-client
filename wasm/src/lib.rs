use bamboo_core::entry::{
    decode as decode_entry, publish as publish_entry, verify as verify_entry,
};
use bamboo_core::lipmaa;
use bamboo_core::{Keypair as BambooKeypair, PublicKey, SecretKey};
use rand::rngs::OsRng;
use serde::Serialize;
use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global allocator
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Serialize)]
enum Error {
    PublicKeyError,
    SecretKeyError,
}

#[no_mangle]
#[wasm_bindgen]
pub extern "C" fn lipmaa_link(seq: u64) -> u64 {
    lipmaa(seq)
}

#[no_mangle]
#[wasm_bindgen]
pub extern "C" fn verify(
    entry_bytes: &[u8],
    payload: Option<Vec<u8>>,
    lipmaa_link: Option<Vec<u8>>,
    backlink: Option<Vec<u8>>,
) -> Result<bool, JsValue> {
    verify_entry(
        entry_bytes,
        payload.as_deref(),
        lipmaa_link.as_deref(),
        backlink.as_deref(),
    )
    .map_err(|err| JsValue::from_serde(&err).unwrap())
}

#[no_mangle]
#[wasm_bindgen]
pub extern "C" fn encode(
    out: &mut [u8],
    public_key: &[u8],
    secret_key: &[u8],
    log_id: u64,
    payload: &[u8],
    is_end_of_feed: bool,
    last_seq_num: u64,
    lipmaa_entry_vec: Option<Vec<u8>>,
    backlink_vec: Option<Vec<u8>>,
) -> Result<usize, JsValue> {
    let public_key = PublicKey::from_bytes(public_key)
        .map_err(|_| JsValue::from_serde(&Error::PublicKeyError).unwrap())?;

    let secret_key = SecretKey::from_bytes(secret_key)
        .map_err(|_| JsValue::from_serde(&Error::SecretKeyError).unwrap())?;

    let key_pair = BambooKeypair {
        public: public_key,
        secret: secret_key,
    };

    publish_entry(
        out,
        Some(&key_pair),
        log_id,
        payload,
        is_end_of_feed,
        last_seq_num,
        lipmaa_entry_vec.as_deref(),
        backlink_vec.as_deref(),
    )
    .map_err(|err| JsValue::from_serde(&err).unwrap())
}

#[no_mangle]
#[wasm_bindgen]
pub extern "C" fn decode(buffer: &[u8]) -> Result<JsValue, JsValue> {
    let entry = decode_entry(buffer).map_err(|err| JsValue::from_serde(&err).unwrap())?;

    Ok(JsValue::from_serde(&entry).unwrap())
}

#[wasm_bindgen]
pub struct Keypair {
    inner: BambooKeypair,
}

#[wasm_bindgen]
impl Keypair {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Keypair {
        let mut csprng: OsRng = OsRng {};
        let keypair = BambooKeypair::generate(&mut csprng);

        Keypair { inner: keypair }
    }

    #[wasm_bindgen(js_name = getPublicKey)]
    pub fn public_key_bytes(&self) -> Vec<u8> {
        Vec::from(&self.inner.public.as_bytes()[..])
    }

    #[wasm_bindgen(js_name = getSecretKey)]
    pub fn secret_key_bytes(&self) -> Vec<u8> {
        Vec::from(&self.inner.secret.as_bytes()[..])
    }
}
