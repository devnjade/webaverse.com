import { getAddress } from './UIStateFunctions';
import { contracts, runSidechainTransaction, web3, getTransactionSignature } from '../webaverse/blockchain.js';
import { previewExt, previewHost, storageHost } from '../webaverse/constants.js';
import { getExt } from '../webaverse/util.js';
import bip39 from '../libs/bip39.js';
import hdkeySpec from '../libs/hdkey.js';
const hdkey = hdkeySpec.default;

export const buyAsset = async (id, networkType, mnemonic, successCallback, errorCallback) => {
  const wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic)).derivePath(`m/44'/60'/0'/0/0`).getWallet();
  const address = wallet.getAddressString();

  const fullAmount = {
    t: 'uint256',
    v: new web3['sidechain'].utils.BN(1e9)
      .mul(new web3['sidechain'].utils.BN(1e9))
      .mul(new web3['sidechain'].utils.BN(1e9)),
  };
  const fullAmountD2 = {
    t: 'uint256',
    v: fullAmount.v.div(new web3['sidechain'].utils.BN(2)),
  };

  try {
    {
      let allowance = await contracts['sidechain']['FT'].methods.allowance(address, contracts['sidechain']['Trade']._address).call();
      allowance = new web3['sidechain'].utils.BN(allowance, 10);
      if (allowance.lt(fullAmountD2.v)) {
        await runSidechainTransaction(mnemonic)('FT', 'approve', contracts['sidechain']['Trade']._address, fullAmount.v);
      }
    }

    const result = await runSidechainTransaction(mnemonic)('Trade', 'buy', id);
    if(result) console.log("Result of buy transaction:", result);

    if (successCallback)
      successCallback(result);
  } catch (error) {
    if (errorCallback)
      errorCallback(error);
  }
};

export const sellAsset = async (id, price, networkType, mnemonic, successCallback, errorCallback) => {
  console.log("Selling asset, price is", price);
  try {
    const network = networkType.toLowerCase() === 'mainnet' ? 'mainnet' : 'sidechain';

    await runSidechainTransaction(mnemonic)('NFT', 'setApprovalForAll', contracts[network]['Trade']._address, true);
    const result = await runSidechainTransaction(mnemonic)('Trade', 'addStore', id, price);
    if(result) console.log("Result of buy transaction:", result);

    if (successCallback)
      successCallback(result);
  } catch (error) {
    if (errorCallback)
      errorCallback(error);
  }
};

export const cancelSale = async (id, networkType, successCallback, errorCallback) => {
  try {
    const network = networkType.toLowerCase() === 'mainnet' ? 'mainnet' : 'sidechain';
    await runSidechainTransaction(mnemonic)('NFT', 'setApprovalForAll', contracts[network]['Trade']._address, true);

    await runSidechainTransaction(mnemonic)('Trade', 'removeStore', id);

    console.log("No buy asset logic");
    if (successCallback)
      successCallback();
  } catch (error) {
    if (errorCallback)
      errorCallback(error);
  }
};

export const setAvatar = async (id, successCallback, errorCallback) => {
  if (!state.loginToken)
    throw new Error('not logged in');
  try {
    const res = await fetch(`https://tokens.webaverse.com/${id}`);
    const token = await res.json();
    const { filename, hash } = token.properties;
    const url = `${storageHost}/${hash.slice(2)}`;
    const ext = getExt(filename);
    const preview = `${previewHost}/${hash.slice(2)}.${ext}/preview.${previewExt}`;
    const address = state.address;
    await Promise.all([
      runSidechainTransaction(state.loginToken.mnemonic)('Account', 'setMetadata', address, 'avatarUrl', url),
      runSidechainTransaction(state.loginToken.mnemonic)('Account', 'setMetadata', address, 'avatarFileName', filename),
      runSidechainTransaction(state.loginToken.mnemonic)('Account', 'setMetadata', address, 'avatarPreview', preview),
    ]);
    if (successCallback)
      successCallback();
  } catch (error) {
    if (errorCallback)
      errorCallback(error);
  }
};

export const mintNft = async (file, name, description, quantity, successCallback, errorCallback, state) => {
  const  mnemonic = state.loginToken.mnemonic;
  const address = state.address;
  const res = await fetch(storageHost, { method: 'POST', body: file });
  const { hash } = await res.json();

  let status, transactionHash, tokenIds;

  try {

    const fullAmount = {
      t: 'uint256',
      v: new web3['sidechain'].utils.BN(1e9)
        .mul(new web3['sidechain'].utils.BN(1e9))
        .mul(new web3['sidechain'].utils.BN(1e9)),
    };
    const fullAmountD2 = {
      t: 'uint256',
      v: fullAmount.v.div(new web3['sidechain'].utils.BN(2)),
    };

    let allowance = await contracts.sidechain.FT.methods.allowance(address, contracts['sidechain']['NFT']._address).call();
    allowance = new web3['sidechain'].utils.BN(allowance, 10);
    if (allowance.lt(fullAmountD2.v)) {
      const result = await runSidechainTransaction(mnemonic)('FT', 'approve', contracts['sidechain']['NFT']._address, fullAmount.v);
      status = result.status;
    } else {
      status = true;
//      transactionHash = '0x0';
//      tokenIds = [];
    }

    if (status) {
      const result = await runSidechainTransaction(mnemonic)('NFT', 'mint', address, '0x' + hash, file.name, description, quantity);

      status = result.status;
      transactionHash = result.transactionHash;
      const tokenId = new web3['sidechain'].utils.BN(result.logs[0].topics[3].slice(2), 16).toNumber();
      tokenIds = [tokenId, tokenId + quantity - 1];
      console.log("Token id is", tokenId);
      successCallback(tokenId);
    }
  } catch (err) {
    console.warn(err);
    status = false;
    transactionHash = '0x0';
    tokenIds = [];
    errorCallback(err);
  }
};

export const setHomespace = async (id, successCallback, errorCallback) => {
  if (!state.loginToken)
    throw new Error('not logged in');
  console.log("Setting homespace");
  try {

    const res = await fetch(`https://tokens.webaverse.com/${id}`);
    const token = await res.json();
    const { filename, hash } = token.properties;
    const url = `${storageHost}/${hash.slice(2)}`;
    const ext = getExt(filename);
    const preview = `${previewHost}/${hash.slice(2)}.${ext}/preview.${previewExt}`;
    const address = state.address;
    await Promise.all([
      runSidechainTransaction(state.loginToken.mnemonic)('Account', 'setMetadata', address, 'homespaceUrl', url),
      runSidechainTransaction(state.loginToken.mnemonic)('Account', 'setMetadata', address, 'homespaceFileName', filename),
      runSidechainTransaction(state.loginToken.mnemonic)('Account', 'setMetadata', address, 'homespacePreview', preview),
    ]);
    if (successCallback !== undefined)
      successCallback();
  } catch (err) {
    console.log("ERROR: ", err);
    if (errorCallback !== undefined)
      errorCallback();
  }
};

export const depositAsset = async (tokenId, networkType, mainnetAddress, state) => {
  console.log("mainnetAddress", mainnetAddress);
  // Deposit to mainnet
  if (networkType === 'webaverse') {
    const id = parseInt(tokenId, 10);
    if (!isNaN(id)) {
      const tokenId = {
        t: 'uint256',
        v: new web3['sidechain'].utils.BN(id),
      };

      const hashSpec = await contracts.sidechain.NFT.methods.getHash(tokenId.v).call();
      const hash = {
        t: 'uint256',
        v: new web3['sidechain'].utils.BN(hashSpec),
      };
      const filenameSpec = await contracts.sidechain.NFT.methods.getMetadata(hashSpec, 'filename').call();
      const filename = {
        t: 'string',
        v: filenameSpec,
      };
      console.log('got filename hash', hash, filename);

      const descriptionSpec = await contracts.sidechain.NFT.methods.getMetadata(hashSpec, 'description').call() || '';
      const description = {
        t: 'string',
        v: descriptionSpec,
      };

      console.log("loginToken", state.loginToken);
      await runSidechainTransaction(state.loginToken.mnemonic)('NFT', 'setApprovalForAll', contracts['sidechain'].NFTProxy._address, true);

      const receipt = await runSidechainTransaction(state.loginToken.mnemonic)('NFTProxy', 'deposit', mainnetAddress, tokenId.v);

      const signature = await getTransactionSignature('sidechain', 'NFT', receipt.transactionHash);
      const timestamp = {
        t: 'uint256',
        v: signature.timestamp,
      };
      const { r, s, v } = signature;

      await contracts.main.NFTProxy.methods.withdraw(mainnetAddress, tokenId.v, hash.v, filename.v, description.v, timestamp.v, r, s, v).send({
        from: mainnetAddress,
      });

      return;
      console.log('OK');
    } else {
      console.log('failed to parse', JSON.stringify(ethNftIdInput.value));
    }
  }  else {
    const id = parseInt(tokenId, 10);
    const tokenId = {
      t: 'uint256',
      v: new web3['main'].utils.BN(id),
    };

    const hashSpec = await contracts.main.NFT.methods.getHash(tokenId.v).call();
    const hash = {
      t: 'uint256',
      v: new web3['main'].utils.BN(hashSpec),
    };
    const filenameSpec = await contracts.main.NFT.methods.getMetadata(hashSpec, 'filename').call();
    const filename = {
      t: 'string',
      v: filenameSpec,
    };

    const descriptionSpec = await contracts.main.NFT.methods.getMetadata(hashSpec, 'description').call();
    const description = {
      t: 'string',
      v: descriptionSpec,
    };


    await _checkMainNftApproved();

    const receipt = await contracts.main.NFTProxy.methods.deposit(myAddress, tokenId.v).send({
      from: mainnetAddress,
    });

    const signature = await getTransactionSignature('main', 'NFT', receipt.transactionHash);

    const { timestamp, r, s, v } = signature;

    await runSidechainTransaction('NFTProxy', 'withdraw', myAddress, tokenId.v, hash.v, filename.v, description.v, timestamp, r, s, v);

    return;
  }
}

const getLoadout = async (address) => {
  const loadoutString = await contracts.sidechain.Account.methods.getMetadata(address, 'loadout').call();
  let loadout = JSON.parse(loadoutString);
  if (!Array.isArray(loadout)) {
    loadout = [];
  }
  while (loadout.length < 8) {
    loadout.push(null);
  }
  return loadout;
}

export const setLoadoutState = async (id, index, state) => {
  if (!state.loginToken)
    throw new Error('not logged in');

  const hashNumberString = await contracts.sidechain.NFT.methods.getHash(id).call();
  const hash = '0x' + web3.sidechain.utils.padLeft(new web3.sidechain.utils.BN(hashNumberString, 10).toString(16), 64);
  const filename = await contracts.sidechain.NFT.methods.getMetadata(hash, 'filename').call();
  const match = filename.match(/^(.+)\.([^\.]+)$/);
  const ext = match ? match[2] : '';

  const itemUrl = `${storageHost}/${hash.slice(2)}${ext ? ('.' + ext) : ''}`;
  const itemFileName = itemUrl.replace(/.*\/([^\/]+)$/, '$1');
  const itemPreview = `${previewHost}/${hash.slice(2)}${ext ? ('.' + ext) : ''}/preview.${previewExt}`;

  const loadout = await getLoadout(state.address);
  loadout.splice(index - 1, 1, [
    itemUrl,
    itemFileName,
    itemPreview
  ]);

  await runSidechainTransaction(state.loginToken.mnemonic)('Account', 'setMetadata', state.address, 'loadout', JSON.stringify(loadout));

  return { ...state, loadout: JSON.stringify(loadout) };
};
