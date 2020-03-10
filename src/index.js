import { request } from 'graphql-request';

import { getItem, hasItem, setItem } from './storage';
import { toHexString, toBytesArray } from './utils';

const BAMBOO_ENDPOINT = 'http://localhost:8000/graphql';
const ENTER_KEYNAME = 'Enter';
const STORAGE_KEYPAIR = 'keypair';
const LOG_ID = 0;

let BambooKeypair;
let encodeBambooEntry;

const keypair = {
  public: null,
  secret: null,
};

const elements = ['key', 'message', 'messageSubmit'].reduce((acc, id) => {
  acc[id] = document.getElementById(id);
  return acc;
}, {});

async function initialize() {
  const wasm = import('../build/wasm');

  try {
    const bamboo = await wasm;
    BambooKeypair = bamboo.Keypair;
    encodeBambooEntry = bamboo.encode;
  } catch (error) {
    console.error('WebAssembly error:', error);
  }

  // Check if we have a stored keypair, otherwise generate a new one
  if (!hasItem(STORAGE_KEYPAIR)) {
    const generated = new BambooKeypair();

    setItem(STORAGE_KEYPAIR, {
      public: Array.from(generated.getPublicKey()),
      secret: Array.from(generated.getSecretKey()),
    });
  }

  const keypairFromStorage = getItem(STORAGE_KEYPAIR);
  keypair.public = new Uint8Array(keypairFromStorage.public);
  keypair.secret = new Uint8Array(keypairFromStorage.secret);

  elements.key.value = toHexString(keypair.public);
}

function setDisabled(ids, status) {
  ids.forEach(id => {
    elements[id].disabled = status;
  });
}

async function graphQLRequest(query, variables) {
  try {
    await request(BAMBOO_ENDPOINT, query, variables);
  } catch (error) {
    console.error('GraphQL error response:', error.response.errors[0].message);
  }
}

async function sendMessage() {
  if (!elements.message.value) {
    return;
  }

  setDisabled(['message', 'messageSubmit'], true);

  // Convert payload to bytes
  const payload = elements.message.value;
  const payloadBytes = [...Buffer.from(payload)];

  // Get last sequence number, lipmaa and backlink entries from
  // server first before we can create a new entry
  let lastSeqNum = 0;
  let lipmaaEntryBytes = undefined;
  let backlinkEntryBytes = undefined;

  try {
    // @TODO: Implement this on the server side
    const query = ``;
    const variables = {};

    const data = await graphQLRequest(query, variables);

    lastSeqNum = data.lastSeqNum;
    lipmaaEntryBytes = toBytesArray(data.encodedEntryLipmaa);
    backlinkEntryBytes = toBytesArray(data.encodedEntryBacklink);
  } catch {
    // Stop here as we can't post anything without this data
    setDisabled(['message', 'messageSubmit'], false);
    return;
  }

  const entryBytes = new Uint8Array(512);
  const isEndOfFeed = false;

  /**
   * @param {Uint8Array} buffer
   * @param {Uint8Array} public_key
   * @param {Uint8Array} secret_key
   * @param {BigInt} log_id
   * @param {Uint8Array} payload
   * @param {boolean} is_end_of_feed
   * @param {BigInt} last_seq_num
   * @param {Uint8Array | undefined} lipmaa_entry
   * @param {Uint8Array | undefined} backlink
   * @returns {number}
   */
  const size = encodeBambooEntry(
    entryBytes,
    keypair.public,
    keypair.secret,
    BigInt(LOG_ID),
    payloadBytes,
    isEndOfFeed,
    BigInt(lastSeqNum),
    lipmaaEntryBytes,
    backlinkEntryBytes,
  );

  // Convert entry & payload to hex strings
  const encodedEntry = toHexString(entryBytes).slice(0, size * 2);
  const encodedPayload = toHexString(payloadBytes);

  // Send GraphQL request to create message
  try {
    const query = `mutation PostNewMessage($message: NewMessage!) {
      postMessage(message: $message) {
        encodedEntry
        encodedPayload
      }
    }`;

    const variables = {
      message: {
        encodedEntry,
        encodedPayload,
      },
    };

    await graphQLRequest(query, variables);
    elements.message.value = '';
  } catch {
    // Do nothing
  }

  setDisabled(['message', 'messageSubmit'], false);
}

elements.messageSubmit.addEventListener('click', async () => {
  await sendMessage();
});

elements.message.addEventListener('keydown', async event => {
  if (event.key === ENTER_KEYNAME) {
    await sendMessage();
  }
});

initialize();
