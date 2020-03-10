import request from './graphql';
import { getItem, hasItem, setItem } from './storage';
import { toHexString, fromHexString, toBytesArray } from './utils';

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
  setDisabled(['message', 'messageSubmit'], true);

  // Get methods and classes from wasm library
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

  // Enable interface as we are ready now
  setDisabled(['message', 'messageSubmit'], false);
}

function setDisabled(ids, status) {
  ids.forEach(id => {
    elements[id].disabled = status;
  });
}

async function sendMessage() {
  if (!elements.message.value) {
    return;
  }

  setDisabled(['message', 'messageSubmit'], true);

  const encodedAuthor = toHexString(keypair.public);

  // Convert payload to bytes
  const payload = elements.message.value;
  const payloadBytes = toBytesArray(payload);

  // Get last sequence number, lipmaa and backlink entries from
  // server first before we can create a new entry
  let lastSeqNum = 0;
  let lipmaaEntryBytes = undefined;
  let backlinkEntryBytes = undefined;

  try {
    const query = `{
      nextMessageArguments(author: "${encodedAuthor}", logId: ${LOG_ID}) {
        encodedEntryLipmaa
        encodedEntryBacklink
        lastSeqNum
      }
    }`;

    const { nextMessageArguments: data } = await request(query);

    // We already have a previous entry, otherwise take defaults
    if (data.encodedEntryBacklink && data.lastSeqNum > 0) {
      lastSeqNum = data.lastSeqNum;
      backlinkEntryBytes = fromHexString(data.encodedEntryBacklink);
      lipmaaEntryBytes = fromHexString(data.encodedEntryLipmaa);
    }
  } catch (error) {
    console.error(error);

    // Stop here as we can't post anything without this data
    setDisabled(['message', 'messageSubmit'], false);
    return;
  }

  const entryBytes = new Uint8Array(512);
  const isEndOfFeed = false;

  /**
   * Encode the bamboo entry
   *
   * @param {Uint8Array} bufferBytes
   * @param {Uint8Array} publicKeyBytes
   * @param {Uint8Array} secretKeyBytes
   * @param {BigInt} logId
   * @param {Uint8Array} payloadBytes
   * @param {boolean} isEndOfFeed
   * @param {BigInt} lastSeqNum
   * @param {Uint8Array | undefined} lipmaaEntryBytes
   * @param {Uint8Array | undefined} backlinkEntryBytes
   * @returns {number} entrySize
   */
  let entrySize;

  try {
    entrySize = encodeBambooEntry(
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
  } catch (error) {
    console.error('Bamboo error:', error);

    // Stop here as we can't post anything without this data
    setDisabled(['message', 'messageSubmit'], false);
    return;
  }

  // Convert entry & payload to hex strings
  const encodedEntry = toHexString(entryBytes.slice(0, entrySize));
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

    await request(query, variables);
    elements.message.value = '';
  } catch (error) {
    console.error(error);
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
